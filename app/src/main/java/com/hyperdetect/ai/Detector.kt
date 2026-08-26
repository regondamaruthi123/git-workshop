package com.hyperdetect.ai

import android.content.Context
import android.graphics.Bitmap
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.gpu.GpuDelegate
import java.io.BufferedReader
import java.io.FileInputStream
import java.io.InputStreamReader
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

/**
 * Result returned by the Detector containing filtered bounding boxes and execution metrics.
 */
data class DetectionResult(
    val detections: List<BoundingBox>,
    val inferenceTimeMs: Long
)

class Detector(
    private val context: Context,
    private val modelPath: String,
    private val labelPath: String,
    private val useGpu: Boolean = false
) {
    private var interpreter: Interpreter? = null
    private var gpuDelegate: GpuDelegate? = null
    private val labels = mutableListOf<String>()

    init {
        // Load COCO label categories
        labels.addAll(loadLabels(context, labelPath))

        val options = Interpreter.Options().apply {
            // OPTIMIZATION: Use 4 threads for quick on-device execution
            setNumThreads(4)
        }

        if (useGpu) {
            try {
                // Initialize GPU Acceleration
                gpuDelegate = GpuDelegate()
                options.addDelegate(gpuDelegate)
            } catch (e: Exception) {
                e.printStackTrace()
                // Falls back automatically to CPU if delegate initialization fails
            }
        }

        // Load the serialized TFLite model from Assets and instantiate the Interpreter
        val modelBuffer = loadModelFile(context, modelPath)
        interpreter = Interpreter(modelBuffer, options)
    }

    /**
     * Executes the object detection pipeline on the provided input bitmap.
     */
    fun detect(bitmap: Bitmap): DetectionResult {
        val startTime = System.currentTimeMillis()

        // 1. Preprocess: Resize image to 640x640 (YOLOv8 target input dimension)
        val resizedBitmap = Bitmap.createScaledBitmap(bitmap, 640, 640, true)

        // 2. Preprocess: Convert pixel channels (RGB order, 0.0 - 1.0 normalization) to ByteBuffer
        val inputBuffer = ByteBuffer.allocateDirect(1 * 640 * 640 * 3 * 4).apply {
            order(ByteOrder.nativeOrder())
        }
        inputBuffer.rewind()

        val intValues = IntArray(640 * 640)
        resizedBitmap.getPixels(intValues, 0, 640, 0, 0, 640, 640)

        for (pixelValue in intValues) {
            val r = ((pixelValue shr 16) and 0xFF) / 255.0f
            val g = ((pixelValue shr 8) and 0xFF) / 255.0f
            val b = (pixelValue and 0xFF) / 255.0f
            inputBuffer.putFloat(r)
            inputBuffer.putFloat(g)
            inputBuffer.putFloat(b)
        }

        // 3. Inspect Model Output Shape dynamically to configure parsing buffers
        val outputTensor = interpreter?.getOutputTensor(0) ?: return DetectionResult(emptyList(), 0)
        val outputShape = outputTensor.shape()

        // Check if output is transposed [1, 84, 8400] vs [1, 8400, 84]
        // Standard YOLOv8 has shape [1, 4 + numClasses, 8400]
        val numFeatures = outputShape[1]
        val isTransposed = numFeatures == (4 + labels.size) || numFeatures == 84

        val totalDetections = if (isTransposed) outputShape[2] else outputShape[1] // e.g. 8400
        val totalFeatures = if (isTransposed) outputShape[1] else outputShape[2] // e.g. 84
        val numClasses = totalFeatures - 4

        val candidates = mutableListOf<BoundingBox>()

        // 4. Allocate multi-dimensional output array and execute model inference
        if (isTransposed) {
            // Shape: [1, 84, 8400]
            val outputBuffer = Array(1) { Array(totalFeatures) { FloatArray(totalDetections) } }
            interpreter?.run(inputBuffer, outputBuffer)

            val inferenceTimeMs = System.currentTimeMillis() - startTime

            // Parse transposed tensor
            for (i in 0 until totalDetections) {
                val cx = outputBuffer[0][0][i]
                val cy = outputBuffer[0][1][i]
                val w = outputBuffer[0][2][i]
                val h = outputBuffer[0][3][i]

                // Find class index with the highest probability score
                var maxScore = 0.0f
                var classId = -1
                for (c in 0 until numClasses) {
                    val score = outputBuffer[0][4 + c][i]
                    if (score > maxScore) {
                        maxScore = score
                        classId = c
                    }
                }

                // Filter predictions based on confidence threshold (> 0.5)
                if (maxScore >= 0.5f) {
                    // Coordinate normalization mapping (checks if outputs are in pixel 0..640 bounds or already normalized)
                    val normCx = if (cx > 1.0f) cx / 640f else cx
                    val normCy = if (cy > 1.0f) cy / 640f else cy
                    val normW  = if (w > 1.0f) w / 640f else w
                    val normH  = if (h > 1.0f) h / 640f else h

                    // Convert Center coords (cx, cy, w, h) to corner coordinates (x1, y1, x2, y2)
                    // Clamp values to prevent UI scaling errors (Upgrade 3: Coordinate clamping)
                    val x1 = (normCx - normW / 2f).coerceIn(0f, 1f)
                    val y1 = (normCy - normH / 2f).coerceIn(0f, 1f)
                    val x2 = (normCx + normW / 2f).coerceIn(0f, 1f)
                    val y2 = (normCy + normH / 2f).coerceIn(0f, 1f)

                    val className = if (classId in labels.indices) labels[classId] else "object"

                    candidates.add(
                        BoundingBox(x1, y1, x2, y2, normCx, normCy, normW, normH, maxScore, classId, className)
                    )
                }
            }

            // 5. Apply Class-wise Non-Maximum Suppression to remove redundant duplicates
            val nmsResults = applyNMS(candidates)
            return DetectionResult(nmsResults, inferenceTimeMs)

        } else {
            // Shape: [1, 8400, 84]
            val outputBuffer = Array(1) { Array(totalDetections) { FloatArray(totalFeatures) } }
            interpreter?.run(inputBuffer, outputBuffer)

            val inferenceTimeMs = System.currentTimeMillis() - startTime

            // Parse non-transposed tensor
            for (i in 0 until totalDetections) {
                val cx = outputBuffer[0][i][0]
                val cy = outputBuffer[0][i][1]
                val w = outputBuffer[0][i][2]
                val h = outputBuffer[0][i][3]

                var maxScore = 0.0f
                var classId = -1
                for (c in 0 until numClasses) {
                    val score = outputBuffer[0][i][4 + c]
                    if (score > maxScore) {
                        maxScore = score
                        classId = c
                    }
                }

                if (maxScore >= 0.5f) {
                    val normCx = if (cx > 1.0f) cx / 640f else cx
                    val normCy = if (cy > 1.0f) cy / 640f else cy
                    val normW  = if (w > 1.0f) w / 640f else w
                    val normH  = if (h > 1.0f) h / 640f else h

                    val x1 = (normCx - normW / 2f).coerceIn(0f, 1f)
                    val y1 = (normCy - normH / 2f).coerceIn(0f, 1f)
                    val x2 = (normCx + normW / 2f).coerceIn(0f, 1f)
                    val y2 = (normCy + normH / 2f).coerceIn(0f, 1f)

                    val className = if (classId in labels.indices) labels[classId] else "object"

                    candidates.add(
                        BoundingBox(x1, y1, x2, y2, normCx, normCy, normW, normH, maxScore, classId, className)
                    )
                }
            }

            val nmsResults = applyNMS(candidates)
            return DetectionResult(nmsResults, inferenceTimeMs)
        }
    }

    /**
     * Filters candidate boxes using Class-wise Non-Maximum Suppression (NMS) to remove overlap.
     */
    private fun applyNMS(boxes: List<BoundingBox>): List<BoundingBox> {
        val sortedBoxes = boxes.sortedByDescending { it.score }.toMutableList()
        val selectedBoxes = mutableListOf<BoundingBox>()

        while (sortedBoxes.isNotEmpty()) {
            val first = sortedBoxes.first()
            selectedBoxes.add(first)
            sortedBoxes.remove(first)

            val iterator = sortedBoxes.iterator()
            while (iterator.hasNext()) {
                val nextBox = iterator.next()
                // UPGRADE 1: Class-wise filtering (Only run suppression between identical classes)
                if (first.classId == nextBox.classId) {
                    val overlap = calculateIoU(first, nextBox)
                    if (overlap >= 0.45f) {
                        iterator.remove()
                    }
                }
            }
        }
        return selectedBoxes
    }

    /**
     * Calculates the Intersection over Union (IoU) of two bounding boxes.
     */
    private fun calculateIoU(box1: BoundingBox, box2: BoundingBox): Float {
        val x1 = maxOf(box1.x1, box2.x1)
        val y1 = maxOf(box1.y1, box2.y1)
        val x2 = minOf(box1.x2, box2.x2)
        val y2 = minOf(box1.y2, box2.y2)

        val interWidth = maxOf(0f, x2 - x1)
        val interHeight = maxOf(0f, y2 - y1)
        val interArea = interWidth * interHeight

        val unionArea = box1.area() + box2.area() - interArea
        return if (unionArea > 0f) interArea / unionArea else 0f
    }

    /**
     * Loads labels lists from the app assets.
     */
    private fun loadLabels(context: Context, filename: String): List<String> {
        val list = mutableListOf<String>()
        context.assets.open(filename).use { stream ->
            BufferedReader(InputStreamReader(stream)).use { reader ->
                var line = reader.readLine()
                while (line != null) {
                    if (line.isNotBlank()) {
                        list.add(line.trim())
                    }
                    line = reader.readLine()
                }
            }
        }
        return list
    }

    /**
     * Maps assets binary model file descriptors directly to read-only Memory-Mapped ByteBuffers.
     */
    private fun loadModelFile(context: Context, path: String): ByteBuffer {
        val descriptor = context.assets.openFd(path)
        val stream = FileInputStream(descriptor.fileDescriptor)
        val channel = stream.channel
        return channel.map(FileChannel.MapMode.READ_ONLY, descriptor.startOffset, descriptor.declaredLength)
    }

    /**
     * Closes the interpreter and releases hardware memory.
     */
    fun close() {
        interpreter?.close()
        interpreter = null
        gpuDelegate?.close()
        gpuDelegate = null
    }
}
