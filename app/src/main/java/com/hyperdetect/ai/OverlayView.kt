package com.hyperdetect.ai

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.View

class OverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var currentBitmap: Bitmap? = null
    private var currentDetections = listOf<BoundingBox>()
    
    // Fitted destination boundary for scaling computations
    private val dstRect = RectF()

    // Premium high-contrast neon colors for bounding boxes
    private val boxColors = intArrayOf(
        Color.parseColor("#00F2FE"), // Electric Cyan
        Color.parseColor("#9B51E0"), // Deep Cyber Purple
        Color.parseColor("#F355FF"), // Neon Synth Pink
        Color.parseColor("#00F59B"), // Bright Mint Green
        Color.parseColor("#FFD600"), // Neon Gold Yellow
        Color.parseColor("#FF3D00"), // Safety Neon Orange
        Color.parseColor("#FF1744"), // Cyber Red
        Color.parseColor("#2979FF")  // Digital Blue
    )

    // Bounding Box stroke paint
    private val boxPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 8f
        isAntiAlias = true
    }

    // Label tag background paint
    private val tagPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    // Label tag text paint
    private val textPaint = Paint().apply {
        color = Color.BLACK
        textSize = 36f
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        isAntiAlias = true
    }

    private val textBounds = Rect()

    /**
     * Updates the image and detections, forcing a redraw.
     */
    fun drawResult(bitmap: Bitmap, detections: List<BoundingBox>) {
        currentBitmap = bitmap
        currentDetections = detections
        invalidate()
    }

    /**
     * Resets the viewport content.
     */
    fun clear() {
        currentBitmap = null
        currentDetections = emptyList()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val bitmap = currentBitmap ?: return

        val vWidth = width.toFloat()
        val vHeight = height.toFloat()
        val bWidth = bitmap.width.toFloat()
        val bHeight = bitmap.height.toFloat()

        val viewRatio = vWidth / vHeight
        val bitmapRatio = bWidth / bHeight

        // Fit-center scaling computation
        if (bitmapRatio > viewRatio) {
            val scaledHeight = vWidth / bitmapRatio
            val top = (vHeight - scaledHeight) / 2f
            dstRect.set(0f, top, vWidth, top + scaledHeight)
        } else {
            val scaledWidth = vHeight * bitmapRatio
            val left = (vWidth - scaledWidth) / 2f
            dstRect.set(left, 0f, left + scaledWidth, vHeight)
        }

        // 1. Draw the resized selected bitmap fitted in viewport
        canvas.drawBitmap(bitmap, null, dstRect, null)

        // 2. Draw all detected boxes and label flags scaled to fits coordinates
        for (box in currentDetections) {
            val color = boxColors[box.classId % boxColors.size]
            boxPaint.color = color
            tagPaint.color = color

            // Translate normalized coordinates [0..1] to viewport bounding coordinates
            val left = dstRect.left + box.x1 * dstRect.width()
            val top = dstRect.top + box.y1 * dstRect.height()
            val right = dstRect.left + box.x2 * dstRect.width()
            val bottom = dstRect.top + box.y2 * dstRect.height()

            // Draw bounding box
            canvas.drawRoundRect(left, top, right, bottom, 12f, 12f, boxPaint)

            // Compose label tag content
            val text = "${box.className.uppercase()} ${(box.score * 100).toInt()}%"
            textPaint.getTextBounds(text, 0, text.length, textBounds)

            val textWidth = textPaint.measureText(text)
            val textHeight = textBounds.height().toFloat()
            val padding = 12f

            // Tag layout positioned directly above the box, clamped inside viewport to prevent off-screen tags
            val tagLeft = left
            val tagTop = (top - textHeight - padding * 2f).coerceAtLeast(dstRect.top)
            val tagRight = (left + textWidth + padding * 2f).coerceAtMost(dstRect.right)
            val tagBottom = top

            // Render label tag background and text
            canvas.drawRoundRect(tagLeft, tagTop, tagRight, tagBottom, 6f, 6f, tagPaint)
            canvas.drawText(text, tagLeft + padding, tagBottom - padding, textPaint)
        }
    }

    /**
     * Composites boxes and label tags directly on the native-resolution original image for high-quality saving.
     */
    fun getCompositedBitmap(): Bitmap? {
        val srcBitmap = currentBitmap ?: return null
        val mutableBitmap = srcBitmap.copy(Bitmap.Config.ARGB_8888, true)
        val canvas = Canvas(mutableBitmap)

        val bWidth = mutableBitmap.width.toFloat()
        val bHeight = mutableBitmap.height.toFloat()

        // Configure native drawing dimensions based on original width scale
        val nativeStrokeWidth = (bWidth * 0.005f).coerceAtLeast(4f)
        val nativeTextSize = (bWidth * 0.022f).coerceAtLeast(16f)

        val saveBoxPaint = Paint().apply {
            style = Paint.Style.STROKE
            strokeWidth = nativeStrokeWidth
            isAntiAlias = true
        }

        val saveTagPaint = Paint().apply {
            style = Paint.Style.FILL
            isAntiAlias = true
        }

        val saveTextPaint = Paint().apply {
            color = Color.BLACK
            textSize = nativeTextSize
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            isAntiAlias = true
        }

        val saveBounds = Rect()

        for (box in currentDetections) {
            val color = boxColors[box.classId % boxColors.size]
            saveBoxPaint.color = color
            saveTagPaint.color = color

            val left = box.x1 * bWidth
            val top = box.y1 * bHeight
            val right = box.x2 * bWidth
            val bottom = box.y2 * bHeight

            canvas.drawRect(left, top, right, bottom, saveBoxPaint)

            val text = "${box.className.uppercase()} ${(box.score * 100).toInt()}%"
            saveTextPaint.getTextBounds(text, 0, text.length, saveBounds)

            val textWidth = saveTextPaint.measureText(text)
            val textHeight = saveBounds.height().toFloat()
            val padding = nativeStrokeWidth * 1.5f

            val tagLeft = left
            val tagTop = (top - textHeight - padding * 2f).coerceAtLeast(0f)
            val tagRight = (left + textWidth + padding * 2f).coerceAtMost(bWidth)
            val tagBottom = top

            canvas.drawRect(tagLeft, tagTop, tagRight, tagBottom, saveTagPaint)
            canvas.drawText(text, tagLeft + padding, tagBottom - padding, saveTextPaint)
        }

        return mutableBitmap
    }
}
