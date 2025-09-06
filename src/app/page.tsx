"use client";

import { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';

// Set up the worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
      setProgress(0);
      setProgressText('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file');
      return;
    }

    setError(null);
    setResult(null);
    setProgress(0);

    try {
      const newPdfDoc = await PDFDocument.create();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const numPages = pdf.numPages;

      let fullText = '';

      for (let i = 1; i <= numPages; i++) {
        setProgressText(`Processing page ${i} of ${numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 3 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, canvas: canvas, viewport: viewport }).promise;
          
          const { data: { text } } = await Tesseract.recognize(
            canvas,
            'eng',
            {
              logger: m => {
                if (m.status === 'recognizing text') {
                  setProgress(Math.round(m.progress * 100));
                }
              }
            }
          );
          fullText += text + '\n\n';

          const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
          newPage.drawText(text, {
            x: 50,
            y: viewport.height - 50,
            size: 12,
          });
        }
      }
      
      setProgressText('Finalizing PDF...');
      const pdfBytes = await newPdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setResult(url);
      setProgress(100);
      setProgressText('Processing complete!');

    } catch (err) {
      console.error(err);
      setError('Failed to process PDF. See console for details.');
      setProgress(0);
      setProgressText('');
    }
  };

  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-bold">PDF OCR with Tesseract</h1>
        <p>Upload a PDF file to extract text and create a new searchable PDF.</p>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
          <button type="submit" className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto" disabled={!file || progress > 0 && progress < 100}>
            {progress > 0 && progress < 100 ? 'Processing...' : 'Upload and Process'}
          </button>
        </form>

        {progress > 0 && (
          <div className="w-full bg-gray-200 rounded-full dark:bg-gray-700">
            <div className="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full" style={{ width: `${progress}%` }}> {progress}%</div>
            <p className="text-center">{progressText}</p>
          </div>
        )}

        {error && <p className="text-red-500">{error}</p>}
        
        {result && (
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Processing Complete</h2>
            <a
              href={result}
              download={`${file?.name.replace('.pdf', '')}_ocr.pdf`}
              className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto"
            >
              Download Processed PDF
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
