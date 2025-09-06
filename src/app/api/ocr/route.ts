import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';

export async function POST(req: NextRequest) {
  try {
    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    const dataFromPdf = await pdf(buffer);


    const { text } = dataFromPdf;

    // Tesseract processing
    const { data: { text: ocrText } } = await Tesseract.recognize(
      buffer,
      'eng',
      { logger: m => console.log(m) }
    );

    const combinedText = text + '\n' + ocrText;

    const page = pdfDoc.addPage();
    page.drawText(combinedText, {
      x: 50,
      y: page.getHeight() - 50,
      size: 12,
    });


    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="ocr-result.pdf"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Failed to process PDF' });
  }
}
