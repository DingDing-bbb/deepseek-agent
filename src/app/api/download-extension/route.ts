import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function GET() {
  try {
    const extensionDir = path.join(process.cwd(), 'extension');
    const tempZipPath = path.join(process.cwd(), 'public', 'deepseek-agent-extension.zip');
    
    // Check if directory exists
    try {
      await fs.access(extensionDir);
    } catch {
      return NextResponse.json({ error: 'Extension directory not found' }, { status: 404 });
    }

    // Create zip file using system zip command
    try {
      // Remove existing zip if exists
      try {
        await fs.unlink(tempZipPath);
      } catch {
        // File doesn't exist, ignore
      }

      // Create zip file
      await execAsync(`cd "${extensionDir}" && zip -r "${tempZipPath}" .`);
    } catch {
      // If zip command fails, try with bun
      try {
        await execAsync(`cd "${extensionDir}" && bun run --bun zip -r "${tempZipPath}" .`);
      } catch {
        // Return error if both fail
        return NextResponse.json({ error: 'Failed to create zip file' }, { status: 500 });
      }
    }

    // Read the zip file
    const zipBuffer = await fs.readFile(tempZipPath);
    
    // Clean up temp file
    await fs.unlink(tempZipPath);

    // Return zip file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="deepseek-agent-extension.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to create download' }, { status: 500 });
  }
}
