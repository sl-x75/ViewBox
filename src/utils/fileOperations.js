// src/utils/fileOperations.js

import fs from 'fs/promises';

/**
 * Reads the content of a file.
 * @param {string} absolutePath - The absolute path to the file.
 * @returns {Promise<string>} A promise that resolves with the file content.
 */
export async function readFileContent(absolutePath) {
    // FIX: Replaced the non-existent `read_file` with the correct `fs.readFile`
    return await fs.readFile(absolutePath, 'utf8');
}

/**
 * Writes content to a file.
 * @param {string} filePath - The absolute path to the file.
 * @param {string} content - The content to write.
 * @returns {Promise<void>}
 */
export async function writeFileContent(filePath, content) {
    // FIX: Replaced the non-existent `write_file` with the correct `fs.writeFile`
    await fs.writeFile(filePath, content, 'utf8');
}