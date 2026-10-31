from pathlib import Path
import json
import random
import numpy as np
import tensorflow as tf

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)

# =====================================================
# CONFIGURATION
# =====================================================

SEED = 42
IMAGE_SIZE = (224, 224)
BATCH_SIZE = 16
INITIAL_EPOCHS = 10
FINE_TUNE_EPOCHS = 5

PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_DIR / "data"
MODEL_DIR = PROJECT_DIR / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

CLASS_FOLDERS = {
    "BLACK SIGATOKA-1": "Black Sigatoka",
    "FUSARIUM WILT-1": "Fusarium Wilt",
    "HEALTHY-1": "Healthy",
}

CLASS_NAMES = [
    "Black Sigatoka",
    "Fusarium Wilt",
    "Healthy",
]

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png"}

random.seed(SEED)
np.random.seed(SEED)
tf.random.set_seed(SEED)

print("=" * 55)
print("BANANA LEAF DISEASE CLASSIFIER")
print("=" * 55)
print("TensorFlow:", tf.__version__)
print("Project directory:", PROJECT_DIR)

# =====================================================
# 1. COLLECT AND SPLIT DATA
# =====================================================

records = []

for folder_name, class_name in CLASS_FOLDERS.items():
    folder = DATA_DIR / folder_name

    if not folder.exists():
        raise FileNotFoundError(
            f"Dataset folder not found: {folder}"
        )

    files = sorted(
        path for path in folder.rglob("*")
        if path.is_file()
        and path.suffix.lower() in VALID_EXTENSIONS
    )

    if not files:
        raise ValueError(f"No images found in {folder}")

    label = CLASS_NAMES.index(class_name)

    for path in files:
        records.append((str(path), label))

    print(f"{class_name}: {len(files)} images")

paths = np.array([record[0] for record in records])
labels = np.array([record[1] for record in records])

# 70% training, 30% temporary
train_paths, temp_paths, train_labels, temp_labels = (
    train_test_split(
        paths,
        labels,
        test_size=0.30,
        random_state=SEED,
        stratify=labels,
    )
)

# Split remaining 30% equally:
# 15% validation and 15% testing
val_paths, test_paths, val_labels, test_labels = (
    train_test_split(
        temp_paths,
        temp_labels,
        test_size=0.50,
        random_state=SEED,
        stratify=temp_labels,
    )
)

print("\nDataset split:")
print("Training:", len(train_paths))
print("Validation:", len(val_paths))
print("Testing:", len(test_paths))

# Save split manifest for reproducibility
manifest = {
    "seed": SEED,
    "class_names": CLASS_NAMES,
    "train": [
        {"path": p, "label": int(y)}
        for p, y in zip(train_paths, train_labels)
    ],
    "validation": [
        {"path": p, "label": int(y)}
        for p, y in zip(val_paths, val_labels)
    ],
    "test": [
        {"path": p, "label": int(y)}
        for p, y in zip(test_paths, test_labels)
    ],
}

manifest_path = MODEL_DIR / "dataset_split.json"

with open(manifest_path, "w", encoding="utf-8") as file:
    json.dump(manifest, file, indent=2)

# =====================================================
# 2. BUILD TENSORFLOW DATASETS
# =====================================================

AUTOTUNE = tf.data.AUTOTUNE

def load_image(path, label):
    image_bytes = tf.io.read_file(path)

    image = tf.io.decode_jpeg(
        image_bytes,
        channels=3,
    )

    image = tf.image.resize(
        image,
        IMAGE_SIZE,
    )

    image = tf.cast(image, tf.float32)

    return image, label


def make_dataset(paths, labels, training=False):
    dataset = tf.data.Dataset.from_tensor_slices(
        (paths, labels)
    )

    if training:
        dataset = dataset.shuffle(
            buffer_size=len(paths),
            seed=SEED,
            reshuffle_each_iteration=True,
        )

    dataset = dataset.map(
        load_image,
        num_parallel_calls=AUTOTUNE,
    )

    if training:
        dataset = dataset.map(
            lambda image, label: (
                tf.image.random_flip_left_right(image),
                label,
            ),
            num_parallel_calls=AUTOTUNE,
        )

    dataset = dataset.batch(BATCH_SIZE)
    dataset = dataset.prefetch(AUTOTUNE)

    return dataset


train_ds = make_dataset(
    train_paths,
    train_labels,
    training=True,
)

val_ds = make_dataset(
    val_paths,
    val_labels,
)

test_ds = make_dataset(
    test_paths,
    test_labels,
)

# =====================================================
# 3. BUILD MOBILENETV2 MODEL
# =====================================================

print("\nLoading pretrained MobileNetV2...")

base_model = tf.keras.applications.MobileNetV2(
    input_shape=(*IMAGE_SIZE, 3),
    include_top=False,
    weights="imagenet",
)

base_model.trainable = False

inputs = tf.keras.Input(
    shape=(*IMAGE_SIZE, 3),
    name="leaf_image",
)

# MobileNetV2 expects pixel values scaled to [-1, 1].
x = tf.keras.applications.mobilenet_v2.preprocess_input(
    inputs
)

x = base_model(x, training=False)

x = tf.keras.layers.GlobalAveragePooling2D()(x)
x = tf.keras.layers.Dropout(0.25)(x)

outputs = tf.keras.layers.Dense(
    len(CLASS_NAMES),
    activation="softmax",
    name="disease_probabilities",
)(x)

model = tf.keras.Model(inputs, outputs)

model.compile(
    optimizer=tf.keras.optimizers.Adam(
        learning_rate=0.001
    ),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

model.summary()

# =====================================================
# 4. TRAIN CLASSIFICATION HEAD
# =====================================================

checkpoint_path = MODEL_DIR / "best_banana_model.keras"

callbacks = [
    tf.keras.callbacks.ModelCheckpoint(
        filepath=str(checkpoint_path),
        monitor="val_loss",
        save_best_only=True,
        verbose=1,
    ),
    tf.keras.callbacks.EarlyStopping(
        monitor="val_loss",
        patience=3,
        restore_best_weights=True,
        verbose=1,
    ),
    tf.keras.callbacks.TerminateOnNaN(),
]

print("\nStarting initial training...")

history_initial = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=INITIAL_EPOCHS,
    callbacks=callbacks,
)

# =====================================================
# 5. FINE-TUNE PART OF MOBILENETV2
# =====================================================

print("\nPreparing fine-tuning...")

base_model.trainable = True

# Keep most pretrained layers frozen.
for layer in base_model.layers[:-30]:
    layer.trainable = False

# Batch normalization layers stay frozen for stability.
for layer in base_model.layers:
    if isinstance(
        layer,
        tf.keras.layers.BatchNormalization,
    ):
        layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(
        learning_rate=0.00001
    ),
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"],
)

print("\nStarting fine-tuning...")

history_fine = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=FINE_TUNE_EPOCHS,
    callbacks=callbacks,
)

# =====================================================
# 6. EVALUATE ON UNSEEN TEST DATA
# =====================================================

print("\nLoading best validation checkpoint...")

model = tf.keras.models.load_model(
    checkpoint_path
)

print("\nEvaluating test dataset...")

test_loss, test_accuracy = model.evaluate(
    test_ds,
    verbose=1,
)

probabilities = model.predict(
    test_ds,
    verbose=1,
)

predicted_labels = np.argmax(
    probabilities,
    axis=1,
)

print("\n" + "=" * 55)
print("FINAL TEST RESULTS")
print("=" * 55)

print(f"Test loss: {test_loss:.4f}")
print(f"Test accuracy: {test_accuracy:.4f}")

print("\nClassification report:")
report = classification_report(
    test_labels,
    predicted_labels,
    labels=list(range(len(CLASS_NAMES))),
    target_names=CLASS_NAMES,
    zero_division=0,
)

print(report)

print("Confusion matrix:")
matrix = confusion_matrix(
    test_labels,
    predicted_labels,
    labels=list(range(len(CLASS_NAMES))),
)

print(matrix)

print("\nSaving final model...")

final_model_path = MODEL_DIR / "banana_disease_model.keras"

model.save(final_model_path)

results = {
    "class_names": CLASS_NAMES,
    "test_images": int(len(test_labels)),
    "test_loss": float(test_loss),
    "test_accuracy": float(test_accuracy),
    "classification_report": report,
    "confusion_matrix": matrix.tolist(),
}

results_path = MODEL_DIR / "evaluation_results.json"

with open(results_path, "w", encoding="utf-8") as file:
    json.dump(results, file, indent=2)

print("\nTRAINING COMPLETE")
print("Model:", final_model_path)
print("Best checkpoint:", checkpoint_path)
print("Split manifest:", manifest_path)
print("Evaluation:", results_path)