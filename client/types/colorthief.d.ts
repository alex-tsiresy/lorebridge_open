declare module 'colorthief' {
  export default class ColorThief {
    /**
     * Returns the most prevalent/dominant color from the image
     * @param img - The HTML image element to analyze
     * @returns RGB color array [r, g, b] representing the most prevalent color
     */
    getColor(img: HTMLImageElement): [number, number, number];
    
    /**
     * Returns a palette of the most prevalent colors from the image
     * @param img - The HTML image element to analyze
     * @param colorCount - Number of colors to return (default: 10)
     * @returns Array of RGB color arrays [[r, g, b], ...] ordered by prevalence
     */
    getPalette(img: HTMLImageElement, colorCount?: number): [number, number, number][];
    
    /**
     * Returns the most prevalent color as a hex string
     * @param img - The HTML image element to analyze
     * @returns Hex color string (e.g., "#ff0000")
     */
    getColorHex(img: HTMLImageElement): string;
    
    /**
     * Returns a palette of the most prevalent colors as hex strings
     * @param img - The HTML image element to analyze
     * @param colorCount - Number of colors to return (default: 10)
     * @returns Array of hex color strings ordered by prevalence
     */
    getPaletteHex(img: HTMLImageElement, colorCount?: number): string[];
  }
} 