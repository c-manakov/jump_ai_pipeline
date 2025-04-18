const path = require('path');

// Import the findCodeInPatch function directly from the source file
// We need to extract it from the source code for testing
const fs = require('fs');
const sourceCode = fs.readFileSync(path.resolve(__dirname, '../src/index.js'), 'utf8');

// Extract the findCodeInPatch function from the source code
// This is a simple approach - in a real-world scenario, you might want to use a more robust method
const findCodeInPatchFn = sourceCode.match(/function findCodeInPatch\([\s\S]*?\n}/)[0];
const findCodeInPatch = new Function('patch', 'codeSnippet', 
  findCodeInPatchFn
    .replace('function findCodeInPatch(patch, codeSnippet) {', '')
    .replace(/return \{[^}]*\};$/, 'return { startLine, endLine, originalIndentation };')
);

describe('findCodeInPatch', () => {
  test('should return null values when patch or code snippet is empty', () => {
    const result = findCodeInPatch(null, 'code');
    expect(result.startLine).toBeNull();
    expect(result.endLine).toBeNull();
    expect(result.originalIndentation).toBeNull();
    
    const result2 = findCodeInPatch('patch', null);
    expect(result2.startLine).toBeNull();
    expect(result2.endLine).toBeNull();
    expect(result2.originalIndentation).toBeNull();
  });
  
  test('should find line numbers for a single line code snippet', () => {
    const patch = `@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;
 const d = 4;`;
    
    const result = findCodeInPatch(patch, 'const b = 2;');
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(2);
  });
  
  test('should find line numbers for a multi-line code snippet', () => {
    const patch = `@@ -1,3 +1,5 @@
 const a = 1;
+const b = 2;
+const e = 5;
 const c = 3;
 const d = 4;`;
    
    const result = findCodeInPatch(patch, 'const b = 2;\nconst e = 5;');
    expect(result.startLine).toBe(2);
    expect(result.endLine).toBe(3);
  });
  
  test('should extract indentation from code snippet', () => {
    const patch = `@@ -1,3 +1,4 @@
 function test() {
+  const indented = true;
 }
 const d = 4;`;
    
    const result = findCodeInPatch(patch, '  const indented = true;');
    expect(result.originalIndentation).toBe('  ');
  });
});
