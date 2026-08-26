package com.hyperdetect.ai

import android.content.ContentValues
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.materialswitch.MaterialSwitch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var btnSelectImage: MaterialButton
    private lateinit var btnSaveImage: MaterialButton
    private lateinit var switchGpu: MaterialSwitch
    private lateinit var overlayView: OverlayView
    private lateinit var detectedCountText: TextView
    private lateinit var inferenceTimeText: TextView
    private lateinit var statusText: TextView
    private lateinit var deviceInfoText: TextView
    private lateinit var loadingLayout: FrameLayout

    private var detector: Detector? = null
    private var selectedBitmap: Bitmap? = null

    // Register ActivityResult launcher for picking image content
    private val selectImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let {
            processSelectedImage(it)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize UI view binds
        btnSelectImage = findViewById(R.id.btnSelectImage)
        btnSaveImage = findViewById(R.id.btnSaveImage)
        switchGpu = findViewById(R.id.switchGpu)
        overlayView = findViewById(R.id.overlayView)
        detectedCountText = findViewById(R.id.detectedCountText)
        inferenceTimeText = findViewById(R.id.inferenceTimeText)
        statusText = findViewById(R.id.statusText)
        deviceInfoText = findViewById(R.id.deviceInfoText)
        loadingLayout = findViewById(R.id.loadingLayout)

        // Set Click Listeners
        btnSelectImage.setOnClickListener {
            selectImageLauncher.launch("image/*")
        }

        btnSaveImage.setOnClickListener {
            checkAndSaveImage()
        }

        // Auto-retrigger inference when acceleration modes toggle, demonstrating latency changes live
        switchGpu.setOnCheckedChangeListener { _, _ ->
            lifecycleScope.launch(Dispatchers.Default) {
                initDetector()
                selectedBitmap?.let { bitmap ->
                    withContext(Dispatchers.Main) {
                        runInference(bitmap)
                    }
                }
            }
        }

        // Perform initial model preload in background thread
        lifecycleScope.launch(Dispatchers.Default) {
            initDetector()
        }
    }

    /**
     * Initializes the TFLite interpreter instance in background.
     */
    private fun initDetector() {
        detector?.close()
        val useGpu = switchGpu.isChecked
        
        // Update device info diagnostics dynamically
        runOnUiThread {
            if (useGpu) {
                deviceInfoText.text = "Device: GPU Delegate"
                deviceInfoText.setTextColor(getColor(R.color.primary_neon))
            } else {
                deviceInfoText.text = "Device: CPU (4 Threads)"
                deviceInfoText.setTextColor(getColor(R.color.text_secondary))
            }
        }

        try {
            detector = Detector(
                context = this,
                modelPath = "yolov8n.tflite",
                labelPath = "labels.txt",
                useGpu = useGpu
            )
        } catch (e: Exception) {
            e.printStackTrace()
            runOnUiThread {
                Toast.makeText(this, "Model load failure: ${e.message}", Toast.LENGTH_LONG).show()
                statusText.text = "Model loading failed. Ensure asset yolov8n.tflite is present."
                statusText.setTextColor(getColor(R.color.alert_neon))
            }
        }
    }

    /**
     * Decodes chosen URI data into a bitmap container and launches inference.
     */
    private fun processSelectedImage(uri: Uri) {
        loadingLayout.visibility = View.VISIBLE
        statusText.text = "Loading selected image..."
        statusText.setTextColor(getColor(R.color.text_secondary))

        lifecycleScope.launch(Dispatchers.IO) {
            val bitmap = loadUriBitmap(uri)
            withContext(Dispatchers.Main) {
                if (bitmap != null) {
                    selectedBitmap = bitmap
                    runInference(bitmap)
                } else {
                    loadingLayout.visibility = View.GONE
                    Toast.makeText(this@MainActivity, "Failed to load selected image", Toast.LENGTH_SHORT).show()
                    statusText.text = "Image loading failed."
                    statusText.setTextColor(getColor(R.color.alert_neon))
                }
            }
        }
    }

    /**
     * Helper to decode image streams safely.
     */
    private fun loadUriBitmap(uri: Uri): Bitmap? {
        return try {
            contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Runs TFLite model detection in background coroutine thread.
     */
    private fun runInference(bitmap: Bitmap) {
        loadingLayout.visibility = View.VISIBLE
        statusText.text = "Inference in progress..."
        statusText.setTextColor(getColor(R.color.text_secondary))

        lifecycleScope.launch(Dispatchers.Default) {
            if (detector == null) {
                initDetector()
            }

            // UPGRADE 3: Robust try-catch around inference to prevent runtime crashes
            var result: DetectionResult? = null
            var errorMsg: String? = null
            try {
                result = detector?.detect(bitmap)
            } catch (e: Exception) {
                e.printStackTrace()
                errorMsg = e.localizedMessage ?: "Unknown inference error"
            }

            withContext(Dispatchers.Main) {
                loadingLayout.visibility = View.GONE
                if (result != null) {
                    // Update overlay drawing view
                    overlayView.drawResult(bitmap, result.detections)
                    
                    // Update diagnostic statistic cards
                    detectedCountText.text = "${result.detections.size} Objects"
                    inferenceTimeText.text = "${result.inferenceTimeMs} ms"

                    // Handle success status message states
                    if (result.detections.isEmpty()) {
                        statusText.text = "No anomalies detected."
                        statusText.setTextColor(getColor(R.color.warning_neon))
                    } else {
                        statusText.text = "Scan completed successfully."
                        statusText.setTextColor(getColor(R.color.success_neon))
                    }

                    // Enable user output saving
                    btnSaveImage.isEnabled = true
                    btnSaveImage.setTextColor(getColor(R.color.text_primary))
                } else {
                    // Render error diagnostics on detection failure
                    statusText.text = "Detection processing failed."
                    statusText.setTextColor(getColor(R.color.alert_neon))
                    Toast.makeText(this@MainActivity, "Detection failed: $errorMsg", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    /**
     * Validates Android permissions for saving photo artifacts on legacy versions.
     */
    private fun checkAndSaveImage() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.WRITE_EXTERNAL_STORAGE), 101)
        } else {
            saveCompositedImage()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                saveCompositedImage()
            } else {
                Toast.makeText(this, "Storage permission is required to save results.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * Saves high-res annotated result bitmap containing overlays to user photos.
     */
    private fun saveCompositedImage() {
        val compositedBitmap = overlayView.getCompositedBitmap()
        if (compositedBitmap == null) {
            Toast.makeText(this, "No generated scan view to save.", Toast.LENGTH_SHORT).show()
            return
        }

        loadingLayout.visibility = View.VISIBLE
        statusText.text = "Saving output artifact to Gallery..."

        lifecycleScope.launch(Dispatchers.IO) {
            val resolver = contentResolver
            val displayName = "HyperDetect_${System.currentTimeMillis()}.jpg"

            val contentValues = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/HyperDetectAI")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }

            val imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)

            if (imageUri != null) {
                try {
                    resolver.openOutputStream(imageUri)?.use { stream ->
                        compositedBitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        contentValues.clear()
                        contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                        resolver.update(imageUri, contentValues, null, null)
                    }

                    withContext(Dispatchers.Main) {
                        loadingLayout.visibility = View.GONE
                        statusText.text = "Saved scan to: Gallery/Pictures/HyperDetectAI"
                        statusText.setTextColor(getColor(R.color.success_neon))
                        Toast.makeText(this@MainActivity, "Image saved successfully!", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    withContext(Dispatchers.Main) {
                        loadingLayout.visibility = View.GONE
                        statusText.text = "Saving failed."
                        statusText.setTextColor(getColor(R.color.alert_neon))
                        Toast.makeText(this@MainActivity, "Save failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            } else {
                withContext(Dispatchers.Main) {
                    loadingLayout.visibility = View.GONE
                    Toast.makeText(this@MainActivity, "Failed to initialize storage record.", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        detector?.close()
    }
}
