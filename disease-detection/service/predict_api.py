from pathlib import Path
import io

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError
from flask import Flask, request, jsonify

# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BASE_DIR / "models" / "banana_disease_model.keras"

CLASS_NAMES = [
    "Black Sigatoka",
    "Fusarium Wilt",
    "Healthy",
]

IMAGE_SIZE = (224, 224)
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_IMAGE_BYTES


# --------------------------------------------------
# LOAD TRAINED MODEL
# --------------------------------------------------

if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Trained model not found: {MODEL_PATH}"
    )

print("Loading banana disease model...")
model = tf.keras.models.load_model(MODEL_PATH)
print("Model loaded successfully.")


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "banana-disease-detection",
        "model_loaded": True,
        "classes": CLASS_NAMES,
    })


# --------------------------------------------------
# PREDICTION
# --------------------------------------------------

@app.post("/predict")
def predict():
    if "image" not in request.files:
        return jsonify({
            "error": "Upload an image using the 'image' field."
        }), 400

    uploaded_file = request.files["image"]

    if not uploaded_file.filename:
        return jsonify({
            "error": "No image file selected."
        }), 400

    image_bytes = uploaded_file.read(MAX_IMAGE_BYTES + 1)

    if not image_bytes:
        return jsonify({
            "error": "The uploaded file is empty."
        }), 400

    if len(image_bytes) > MAX_IMAGE_BYTES:
        return jsonify({
            "error": "Image exceeds the 10 MB limit."
        }), 413

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            source.verify()

        with Image.open(io.BytesIO(image_bytes)) as source:
            image = source.convert("RGB")
            image = image.resize(IMAGE_SIZE)

            image_array = np.asarray(
                image,
                dtype=np.float32,
            )

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):
        return jsonify({
            "error": "Invalid or unsupported image."
        }), 400

    # The model accepts RGB pixels in the range [0, 255].
    # Its internal preprocessing layer scales them for MobileNetV2.
    batch = np.expand_dims(image_array, axis=0)

    probabilities = model.predict(
        batch,
        verbose=0,
    )[0]

    predicted_index = int(np.argmax(probabilities))
    confidence = float(probabilities[predicted_index])

    scores = {
        CLASS_NAMES[i]: round(float(probabilities[i]), 6)
        for i in range(len(CLASS_NAMES))
    }

    # Conservative abstention threshold. This is a preliminary
    # safeguard, not a clinically or agriculturally validated threshold.
    if confidence < 0.70:
        return jsonify({
            "status": "uncertain",
            "message": (
                "The model is uncertain. Try a clearer photo "
                "or seek advice from an agricultural expert."
            ),
            "confidence": round(confidence, 4),
            "probabilities": scores,
            "disclaimer": (
                "This is an AI screening result, not a definitive diagnosis."
            ),
        })

    predicted_class = CLASS_NAMES[predicted_index]

    guidance = {
        "Black Sigatoka": (
            "Possible Black Sigatoka: inspect the leaf for dark "
            "streaks and expanding lesions. Seek local agricultural "
            "expert advice before choosing a treatment."
        ),
        "Fusarium Wilt": (
            "Possible Fusarium wilt: inspect the whole plant for "
            "yellowing and wilting. Obtain expert confirmation because "
            "other conditions can cause similar symptoms."
        ),
        "Healthy": (
            "The image resembles the healthy class in this model. "
            "Continue routine crop monitoring."
        ),
    }

    return jsonify({
        "status": "success",
        "prediction": predicted_class,
        "confidence": round(confidence, 4),
        "confidence_percent": round(confidence * 100, 2),
        "probabilities": scores,
        "guidance": guidance[predicted_class],
        "disclaimer": (
            "AI screening only. Accuracy on real farm photographs "
            "has not yet been established."
        ),
    })


# --------------------------------------------------
# START SERVICE
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=False,
    )