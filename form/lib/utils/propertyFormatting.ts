/**
 * Utility functions for formatting property information display
 */

/**
 * Formats property levels for display
 * @param levels - The raw levels value from database
 * @returns Formatted string or original value if not a number
 */
export function formatPropertyLevels(levels: any): string {
  if (!levels) return '';
  
  // Convert to string and extract numeric part
  const levelsStr = String(levels);
  const numericMatch = levelsStr.match(/(\d+)/);
  
  if (!numericMatch) {
    return levelsStr; // Return original if no number found
  }
  
  const numericValue = parseInt(numericMatch[1], 10);
  
  switch (numericValue) {
    case 1:
      return 'Single Storey';
    case 2:
      return 'Double Storey';
    case 3:
      return 'Triple Storey';
    default:
      return levelsStr; // Return original for other values
  }
}

/**
 * Formats basement information for display
 * @param basement - The raw basement value from database
 * @returns "Yes" or "No"
 */
export function formatPropertyBasement(basement: any): string {
  if (typeof basement === 'boolean') {
    return basement ? 'Yes' : 'No';
  }
  
  // Handle string values
  const basementStr = String(basement || '').toLowerCase();
  
  if (basementStr === 'true' || basementStr === 'yes') {
    return 'Yes';
  }
  
  if (basementStr === 'false' || basementStr === 'no') {
    return 'No';
  }
  
  // Return original value if it doesn't match expected patterns
  return basementStr || 'No';
}
