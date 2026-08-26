package com.hyperdetect.ai

/**
 * Represents a single detected object box.
 * Coordinates are normalized to [0..1] range, mapping relative to the image size.
 */
data class BoundingBox(
    val x1: Float, // Left boundary (clamped between 0.0 and 1.0)
    val y1: Float, // Top boundary (clamped between 0.0 and 1.0)
    val x2: Float, // Right boundary (clamped between 0.0 and 1.0)
    val y2: Float, // Bottom boundary (clamped between 0.0 and 1.0)
    val cx: Float, // Center X coordinate
    val cy: Float, // Center Y coordinate
    val w: Float,  // Box width
    val h: Float,  // Box height
    val score: Float,     // Confidence score (0.0 to 1.0)
    val classId: Int,     // ID of class
    val className: String  // Label name of class (e.g. "person")
) {
    /**
     * Calculates the area of the bounding box.
     */
    fun area(): Float {
        val width = x2 - x1
        val height = y2 - y1
        return if (width > 0 && height > 0) width * height else 0f
    }
}
