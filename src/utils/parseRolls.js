/**
 * Utility functions for parsing and validating roll numbers
 */

/**
 * Parse roll numbers from input string (space/comma/mixed separated)
 * @param {string} input - Raw input string containing roll numbers
 * @returns {string[]} - Array of unique, trimmed roll numbers
 */
export const parseRolls = (input) => {
  if (!input || typeof input !== 'string') {
    return [];
  }

  // Split by comma, space, newline, or tab
  const rolls = input
    .split(/[,\s\n\t]+/)
    .map(roll => roll.trim())
    .filter(roll => roll.length > 0);

  // Remove duplicates while preserving order
  return [...new Set(rolls)];
};

/**
 * Parse CSV content to extract roll numbers
 * @param {string} csvContent - CSV file content
 * @param {boolean} hasHeader - Whether CSV has header row
 * @returns {string[]} - Array of roll numbers
 */
export const parseCSVRolls = (csvContent, hasHeader = true) => {
  if (!csvContent) return [];

  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length === 0) return [];

  // Skip header if present
  const dataLines = hasHeader ? lines.slice(1) : lines;
  
  const rolls = [];
  
  dataLines.forEach(line => {
    // Handle CSV with commas or just single column
    const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
    
    // Take first non-empty column as roll number
    const roll = columns.find(col => col.length > 0);
    if (roll) {
      rolls.push(roll);
    }
  });

  // Remove duplicates
  return [...new Set(rolls)];
};

/**
 * Validate roll number format (basic validation)
 * @param {string} roll - Roll number to validate
 * @returns {boolean} - Whether roll number is valid
 */
export const validateRollNumber = (roll) => {
  if (!roll || typeof roll !== 'string') return false;
  
  // Basic validation - alphanumeric, minimum 3 characters
  const rollPattern = /^[A-Za-z0-9]{3,}$/;
  return rollPattern.test(roll.trim());
};

/**
 * Validate array of roll numbers
 * @param {string[]} rolls - Array of roll numbers
 * @returns {Object} - Validation result with valid/invalid rolls
 */
export const validateRolls = (rolls) => {
  const valid = [];
  const invalid = [];

  rolls.forEach(roll => {
    if (validateRollNumber(roll)) {
      valid.push(roll);
    } else {
      invalid.push(roll);
    }
  });

  return { valid, invalid };
};
