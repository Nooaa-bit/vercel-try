"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";

// ✅ Lazy load cropper library
const Cropper = dynamic(() => import("react-easy-crop"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  ),
});

interface ProfilePictureCropProps {
  currentImageUrl: string | null;
  onImageSelected: (file: File) => void;
}

interface CroppedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ✅ Constants for validation
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_DIMENSION = 1024; // Max width/height for profile picture

export default function ProfilePictureCrop({
  currentImageUrl,
  onImageSelected,
}: ProfilePictureCropProps) {
  const { t } = useTranslation("settings"); // ✅ Add translation hook

  const [isOpen, setIsOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] =
    useState<CroppedArea | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("image/jpeg");
  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (imageSrc && imageSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [previewUrl, imageSrc]);

  // ✅ FIXED: Use objectURL instead of base64
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];

      // Reset input value to allow re-selecting the same file
      e.target.value = "";

      // ✅ File type validation
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(t("crop.errors.invalidType"));
        return;
      }

      // ✅ File size validation
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t("crop.errors.tooLarge"));
        return;
      }

      setFileName(file.name);
      setFileType(file.type);

      // ✅ NEW: Use objectURL instead of FileReader
      const objectUrl = URL.createObjectURL(file);
      setImageSrc(objectUrl);
      setIsOpen(true);
    }
  };

  const onCropComplete = useCallback(
    (_: CroppedArea, croppedAreaPixels: CroppedArea) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  // ✅ Compress and create cropped image
  const createCroppedImage = async (): Promise<File | null> => {
    if (!imageSrc || !croppedAreaPixels) return null;

    try {
      const image = new Image();
      image.src = imageSrc;

      // ✅ Add error handling for image load
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Failed to load image"));
      });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }

      // ✅ Calculate dimensions (compress if needed)
      let finalWidth = croppedAreaPixels.width;
      let finalHeight = croppedAreaPixels.height;

      if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(finalWidth, finalHeight);
        finalWidth = Math.round(finalWidth * scale);
        finalHeight = Math.round(finalHeight * scale);
      }

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // Draw cropped and resized image
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        finalWidth,
        finalHeight
      );

      // ✅ Convert to blob with quality control
      return new Promise<File>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // ✅ Revoke old preview URL before creating new one
              if (previewUrl && previewUrl.startsWith("blob:")) {
                URL.revokeObjectURL(previewUrl);
              }

              const file = new File([blob], fileName, { type: fileType });
              const croppedPreviewUrl = URL.createObjectURL(blob);
              setPreviewUrl(croppedPreviewUrl);
              resolve(file);
            } else {
              reject(new Error("Failed to create blob"));
            }
          },
          fileType,
          0.9
        );
      });
    } catch (error) {
      console.error("Crop error:", error);
      throw error;
    }
  };

  const handleApply = async () => {
    setIsProcessing(true);

    try {
      const croppedFile = await createCroppedImage();
      if (croppedFile) {
        onImageSelected(croppedFile);

        // ✅ FIXED: Revoke imageSrc URL after processing
        if (imageSrc && imageSrc.startsWith("blob:")) {
          URL.revokeObjectURL(imageSrc);
        }

        setIsOpen(false);
        setImageSrc(null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
      }
    } catch (error) {
      console.error("Error applying crop:", error);
      toast.error(t("crop.errors.cropFailed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    // ✅ FIXED: Cleanup objectURL on cancel
    if (imageSrc && imageSrc.startsWith("blob:")) {
      URL.revokeObjectURL(imageSrc);
    }
    setIsOpen(false);
    setImageSrc(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  return (
    <>
      <div className="flex items-start gap-6">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t("photo.altText")}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-16 h-16 text-muted-foreground"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <label
            htmlFor="profilePictureInput"
            className="absolute bottom-0 right-0 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-md cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <input
              type="file"
              id="profilePictureInput"
              accept="image/jpeg,image/jpg,image/png"
              onChange={onFileChange}
              className="hidden"
            />
          </label>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>{t("photo.clickToChange")}</p>
          <p className="mt-1">{t("photo.cropInstructions")}</p>
          <p className="mt-2 text-xs">{t("photo.requirements")}</p>
        </div>
      </div>

      {isOpen && imageSrc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl shadow-elegant max-w-2xl w-full mx-4">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">
                {t("crop.title")}
              </h2>
            </div>

            <div className="relative h-96 bg-muted">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropSizeChange={() => {}}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                rotation={0}
                minZoom={1}
                maxZoom={3}
                zoomSpeed={1}
                cropSize={{ width: 400, height: 400 }}
                onMediaLoaded={() => {}}
                onTouchRequest={() => true}
                restrictPosition={true}
                style={{ containerStyle: {} }}
                classes={{
                  containerClassName: "",
                  mediaClassName: "",
                  cropAreaClassName: "",
                }}
                mediaProps={{}}
                cropperProps={{}}
                keyboardStep={5}
              />
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  {t("crop.zoom")}
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full"
                  disabled={isProcessing}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="px-6 py-2 border border-border rounded-xl hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("crop.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                      {t("crop.processing")}
                    </>
                  ) : (
                    t("crop.apply")
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
