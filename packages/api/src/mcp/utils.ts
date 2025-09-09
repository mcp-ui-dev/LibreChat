import { Constants } from 'librechat-data-provider';

export const mcpToolPattern = new RegExp(`^.+${Constants.mcp_delimiter}.+$`);
/**
 * Normalizes a server name to match the pattern ^[a-zA-Z0-9_.-]+$
 * This is required for Azure OpenAI models with Tool Calling
 */
export function normalizeServerName(serverName: string): string {
  // Check if the server name already matches the pattern
  if (/^[a-zA-Z0-9_.-]+$/.test(serverName)) {
    return serverName;
  }

  /** Replace non-matching characters with underscores.
    This preserves the general structure while ensuring compatibility.
    Trims leading/trailing underscores
    */
  const normalized = serverName.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^_+|_+$/g, '');

  // If the result is empty (e.g., all characters were non-ASCII and got trimmed),
  // generate a fallback name to ensure we always have a valid function name
  if (!normalized) {
    /** Hash of the original name to ensure uniqueness */
    let hash = 0;
    for (let i = 0; i < serverName.length; i++) {
      hash = (hash << 5) - hash + serverName.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return `server_${Math.abs(hash)}`;
  }

  return normalized;
}

/**
 * Sanitizes a URL by removing query parameters to prevent credential leakage in logs.
 * @param url - The URL to sanitize (string or URL object)
 * @returns The sanitized URL string without query parameters
 */
export function sanitizeUrlForLogging(url: string | URL): string {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return '[invalid URL]';
  }
}

export const uiResourcesInstructions = `The tool response contains UI resources (URIs starting with "ui://").
Include them in your response using markers:

**CITE UI RESOURCES:**
Use markers to reference UI resources in your text after introducing them:
- Single resource: "Here's the product details \ue205ui0"
- Multiple resources shown separately: "Browse these products \ue205ui0 \ue205ui1 \ue205ui2"
- Multiple resources in carousel: "View these items \ue205ui0,1,2"

The format is: \ue205ui{index} or \ue205ui{index1,index2,index3}
- {index} is the 0-based index of the resource in the tool response
- Use comma-separated indices to show resources in a carousel

**ALWAYS describe what you're showing before the marker. The UI will be rendered inline where you place the marker.**`;
