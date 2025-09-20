// Convert RGB colors to CSS gradient using actual emoji colors
export function rgbToTailwindGradient(rgbColors: string[]): string {
  if (rgbColors.length < 2) {
    return "from-blue-500 to-purple-600"; // Default fallback
  }

  // Use the first two colors from the emoji palette
  const color1 = rgbColors[0];
  const color2 = rgbColors[1];

  // Extract RGB values and create a custom gradient
  const match1 = color1.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const match2 = color2.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  
  if (!match1 || !match2) {
    return "from-blue-500 to-purple-600"; // Fallback
  }

  const [, r1, g1, b1] = match1.map(Number);
  const [, r2, g2, b2] = match2.map(Number);

  // Create a custom gradient using the actual emoji colors
  // We'll use CSS custom properties to create a more accurate gradient
  return `from-[rgb(${r1},${g1},${b1})] to-[rgb(${r2},${g2},${b2})]`;
}

// Fallback gradient for when emoji color extraction fails
export const DEFAULT_GRADIENT = "from-blue-500 to-purple-600"; 