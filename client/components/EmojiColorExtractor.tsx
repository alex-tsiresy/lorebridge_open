import { useEffect, useRef, useState } from "react";
import ColorThief from "colorthief";
import { logger } from '@/lib/logger';

interface EmojiColorExtractorProps {
  emoji: string;
  onColorsExtracted?: (colors: string[]) => void;
}

export default function EmojiColorExtractor({ emoji, onColorsExtracted }: EmojiColorExtractorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    if (!canvasRef.current || !emoji) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw emoji with better rendering
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "120px Apple Color Emoji, Noto Color Emoji, Segoe UI Emoji, Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(emoji, canvas.width / 2, canvas.height / 2);

    // Convert to image for ColorThief
    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => {
      try {
        const thief = new ColorThief();
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;
        
        tempCtx.drawImage(img, 0, 0);

        // First, get the most prevalent color using getColor()
        const dominantColor = thief.getColor(img);
        const dominantRgb = `rgb(${dominantColor[0]}, ${dominantColor[1]}, ${dominantColor[2]})`;
        
        // Then get additional colors from palette for variety
        const palette = thief.getPalette(img, 6); // Get fewer colors since we already have the dominant one
        const paletteColors = palette
          .filter(([r, g, b], index) => {
            // Skip the first color if it's too similar to our dominant color
            if (index === 0) {
              const distance = Math.sqrt(
                Math.pow(r - dominantColor[0], 2) + 
                Math.pow(g - dominantColor[1], 2) + 
                Math.pow(b - dominantColor[2], 2)
              );
              return distance > 30; // Only keep if sufficiently different
            }
            return true;
          })
          .map(([r, g, b]: [number, number, number]) => `rgb(${r}, ${g}, ${b})`)
          .slice(0, 2); // Limit to 2 additional colors
        
        // Combine dominant color with palette colors, ensuring dominant is first
        const finalColors = [dominantRgb, ...paletteColors];
        
        setColors(finalColors);
        
        if (onColorsExtracted) {
          onColorsExtracted(finalColors);
        }
      } catch (error) {
        logger.error("Error extracting colors from emoji:", error);
        // Fallback to default colors if extraction fails
        const fallbackColors = ["rgb(59, 130, 246)", "rgb(147, 51, 234)"];
        setColors(fallbackColors);
        if (onColorsExtracted) {
          onColorsExtracted(fallbackColors);
        }
      }
    };
  }, [emoji, onColorsExtracted]);

  return (
    <canvas 
      ref={canvasRef} 
      width={128} 
      height={128} 
      style={{ display: "none" }} 
    />
  );
} 