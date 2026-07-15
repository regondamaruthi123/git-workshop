import os
import io
import base64
import numpy as np
import cv2
from flask import Flask, request, jsonify
from flask_cors import CORS
from scipy.spatial.distance import mahalanobis

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Try importing PyTorch for CNN autoencoder
PYTORCH_AVAILABLE = False
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    PYTORCH_AVAILABLE = True
    print("[AI-Service] PyTorch is available. CNN Autoencoder enabled.")
except ImportError:
    print("[AI-Service] PyTorch not found. Falling back to high-precision PCA & RX Spectral anomaly detection.")

# Define CNN Autoencoder in PyTorch if available
if PYTORCH_AVAILABLE:
    class CNNAutoencoder(nn.Module):
        def __init__(self):
            super(CNNAutoencoder, self).__init__()
            # Encoder
            self.encoder = nn.Sequential(
                nn.Conv2d(3, 16, kernel_size=3, stride=2, padding=1),  # [B, 16, H/2, W/2]
                nn.ReLU(True),
                nn.Conv2d(16, 32, kernel_size=3, stride=2, padding=1), # [B, 32, H/4, W/4]
                nn.ReLU(True),
                nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1), # [B, 64, H/8, W/8]
                nn.ReLU(True)
            )
            # Decoder
            self.decoder = nn.Sequential(
                nn.ConvTranspose2d(64, 32, kernel_size=3, stride=2, padding=1, output_padding=1), # [B, 32, H/4, W/4]
                nn.ReLU(True),
                nn.ConvTranspose2d(32, 16, kernel_size=3, stride=2, padding=1, output_padding=1), # [B, 16, H/2, W/2]
                nn.ReLU(True),
                nn.ConvTranspose2d(16, 3, kernel_size=3, stride=2, padding=1, output_padding=1),  # [B, 3, H, W]
                nn.Sigmoid()
            )

        def forward(self, x):
            x = self.encoder(x)
            x = self.decoder(x)
            return x

def run_rx_detector(img_rgb):
    """
    Reed-Xiaoli (RX) Anomaly Detector.
    Calculates the Mahalanobis distance of each pixel from the background distribution.
    """
    h, w, c = img_rgb.shape
    pixels = img_rgb.reshape(-1, c).astype(np.float64)
    
    # Calculate mean vector and covariance matrix
    mean_vec = np.mean(pixels, axis=0)
    cov_matrix = np.cov(pixels, rowvar=False)
    
    # Add a small regularization term to the diagonal to avoid singularity
    cov_matrix += np.eye(c) * 1e-6
    
    inv_cov = np.linalg.inv(cov_matrix)
    
    # Compute RX scores (Mahalanobis distance squared)
    diff = pixels - mean_vec
    rx_scores = np.sum(diff @ inv_cov * diff, axis=1)
    rx_scores = rx_scores.reshape(h, w)
    
    return rx_scores

def run_pca_reconstruction(img_rgb):
    """
    PCA-based reconstruction error anomaly detection.
    Identifies pixels that deviate from the primary principal components.
    """
    from sklearn.decomposition import PCA
    h, w, c = img_rgb.shape
    pixels = img_rgb.reshape(-1, c).astype(np.float64) / 255.0
    
    # Fit PCA on the pixels. Keep 2 out of 3 components to lose some details
    pca = PCA(n_components=2)
    transformed = pca.fit_transform(pixels)
    reconstructed = pca.inverse_transform(transformed)
    
    # Compute reconstruction error (MSE per pixel)
    recon_error = np.mean((pixels - reconstructed) ** 2, axis=1)
    recon_error = recon_error.reshape(h, w)
    
    return recon_error

def run_cnn_autoencoder(img_rgb):
    """
    CNN Autoencoder anomaly detection.
    Trains a lightweight CNN model briefly on the target image and evaluates reconstruction error.
    """
    h, w, c = img_rgb.shape
    # Resize image to a standard size for deep learning processing (e.g. 256x256)
    img_resized = cv2.resize(img_rgb, (256, 256))
    
    # Convert to PyTorch Tensor [1, 3, 256, 256]
    img_tensor = torch.tensor(img_resized, dtype=torch.float32).permute(2, 0, 1).unsqueeze(0) / 255.0
    
    # Initialize model
    model = CNNAutoencoder()
    criterion = nn.MSELoss(reduction='none')
    optimizer = optim.Adam(model.parameters(), lr=0.01)
    
    # Train for a few steps to learn the background representation of this specific image
    model.train()
    for epoch in range(15):  # Very fast on small images
        optimizer.zero_grad()
        output = model(img_tensor)
        loss = torch.mean(criterion(output, img_tensor))
        loss.backward()
        optimizer.step()
        
    # Evaluate
    model.eval()
    with torch.no_grad():
        output = model(img_tensor)
        # Compute reconstruction error maps
        err_tensor = criterion(output, img_tensor) # [1, 3, 256, 256]
        err_map = torch.mean(err_tensor, dim=1).squeeze(0).numpy() # [256, 256]
        
    # Resize error map back to original image size
    err_map = cv2.resize(err_map, (w, h))
    return err_map

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "pytorch_available": PYTORCH_AVAILABLE
    })

@app.route('/detect', methods=['POST'])
def detect():
    try:
        # Check if image exists in request
        if 'image' not in request.files:
            return jsonify({"error": "No image file provided"}), 400
            
        file = request.files['image']
        file_bytes = file.read()
        
        # Convert bytes to numpy array for OpenCV
        np_arr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return jsonify({"error": "Invalid image file format"}), 400
            
        h, w, c = img.shape
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Run selected anomaly detection logic
        # If PyTorch is available, run CNN. Otherwise run PCA/RX
        detection_method = "RX Spectral"
        if PYTORCH_AVAILABLE:
            try:
                anomaly_map = run_cnn_autoencoder(img_rgb)
                detection_method = "CNN Autoencoder"
            except Exception as e:
                print(f"[AI-Service] CNN autoencoder failed: {str(e)}. Falling back to RX.")
                anomaly_map = run_rx_detector(img_rgb)
        else:
            # Combine RX and PCA error for high precision
            rx = run_rx_detector(img_rgb)
            # Normalize RX
            rx_norm = (rx - rx.min()) / (rx.max() - rx.min() + 1e-6)
            
            pca_err = run_pca_reconstruction(img_rgb)
            # Normalize PCA
            pca_norm = (pca_err - pca_err.min()) / (pca_err.max() - pca_err.min() + 1e-6)
            
            # Combine them
            anomaly_map = 0.5 * rx_norm + 0.5 * pca_norm
            detection_method = "Ensemble (RX + PCA)"
            
        # Normalize anomaly map to 0 - 255
        anomaly_min = anomaly_map.min()
        anomaly_max = anomaly_map.max()
        anomaly_norm = ((anomaly_map - anomaly_min) / (anomaly_max - anomaly_min + 1e-6) * 255).astype(np.uint8)
        
        # Threshold the anomaly map to check if anomaly exists
        # A simple Otsu's thresholding or percentage of high value pixels
        _, thresh = cv2.threshold(anomaly_norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        anomaly_pixels_ratio = np.sum(thresh == 255) / (h * w)
        
        # Calculate overall anomaly score / prediction confidence
        # If there are sharp concentrated anomalous spots, it's a strong anomaly.
        # We can look at the average score of the top 1% highest scoring pixels.
        flat_norm = anomaly_norm.flatten()
        flat_norm.sort()
        top_1_percent_mean = np.mean(flat_norm[-int(len(flat_norm) * 0.01):])
        
        # Thresholding logic:
        # If top 1% mean is high and anomaly pixels ratio is within reasonable bounds (not the entire image)
        detected = bool(top_1_percent_mean > 160 and anomaly_pixels_ratio < 0.35)
        
        # Accuracy/Confidence score: map top 1% mean to a scale of 70% to 98%
        if detected:
            confidence = float(70.0 + (top_1_percent_mean - 160.0) / (255.0 - 160.0) * 28.0)
        else:
            confidence = float(75.0 + (160.0 - top_1_percent_mean) / 160.0 * 23.0)
            
        # Limit confidence bounds
        confidence = min(max(confidence, 65.0), 99.2)
        
        # Generate colorized heatmap
        # Using JET colormap (blue = background, red = anomaly hotspot)
        heatmap_color = cv2.applyColorMap(anomaly_norm, cv2.COLORMAP_JET)
        
        # Apply overlay (blend original image with heatmap)
        overlay = cv2.addWeighted(img, 0.4, heatmap_color, 0.6, 0)
        
        # Encode overlay image as base64
        _, buffer = cv2.imencode('.png', overlay)
        heatmap_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Also encode raw heatmap mask
        _, mask_buffer = cv2.imencode('.png', heatmap_color)
        mask_base64 = base64.b64encode(mask_buffer).decode('utf-8')
        
        return jsonify({
            "detected": detected,
            "accuracy": round(confidence, 2),
            "method": detection_method,
            "heatmap": f"data:image/png;base64,{heatmap_base64}",
            "heatmap_mask": f"data:image/png;base64,{mask_base64}",
            "stats": {
                "max_score": float(anomaly_max),
                "min_score": float(anomaly_min),
                "anomaly_ratio": float(anomaly_pixels_ratio)
            }
        })
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

if __name__ == '__main__':
    # Get port from environment or default to 5001
    port = int(os.environ.get('PORT', 5001))
    print(f"[AI-Service] Starting Flask server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
