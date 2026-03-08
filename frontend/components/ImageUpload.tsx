'use client';

import { useState, useRef } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface ImageUploadProps {
  /** Called with the uploaded image URL (or empty string on clear). */
  onUpload: (url: string) => void;
  /** Currently set URL (controlled). */
  value?: string;
}

/**
 * Drag-and-drop / click-to-select image uploader.
 * Uploads to the backend /api/uploads/image endpoint (Cloudinary)
 * and returns the public URL via onUpload.
 */
export function ImageUpload({ onUpload, value }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const { data } = await api.post<{ url: string }>('/uploads/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpload(data.url);
    } catch {
      toast.error('Image upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  }

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden">
        <img
          src={value}
          alt="Upload preview"
          className="w-full max-h-48 object-cover rounded-lg"
          referrerPolicy="no-referrer"
        />
        <button
          type="button"
          onClick={() => onUpload('')}
          className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition"
          aria-label="Remove image"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className={`w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-sm transition cursor-pointer
          ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
          ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        ) : (
          <Camera className="h-6 w-6 text-gray-400" />
        )}
        <span className="text-gray-500">
          {uploading ? 'Uploading…' : 'Click or drag a photo'}
        </span>
        <span className="text-xs text-gray-400">Max 5 MB</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
