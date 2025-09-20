import { getApiBase } from './apiBase';
import { logger } from '@/lib/logger';
const API_BASE_URL = getApiBase({ allowLocalhost: true });

export type AssetType = 'video' | 'pdf' | 'audio' | 'website' | 'youtube' | 'instagram';

export class ApiClient {
  private baseURL: string;
  private getToken?: () => Promise<string | null>;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  // Set the token getter function (usually from useAuth hook)
  setTokenGetter(getToken: () => Promise<string | null>) {
    this.getToken = getToken;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Get the auth token if available
    if (this.getToken) {
      try {
        const token = await this.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        logger.warn('Failed to get auth token:', error);
      }
    }

    return headers;
  }

  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL || ''}${endpoint}`;
    
    try {
      const headers = await this.getAuthHeaders();
      
      // Don't set Content-Type for FormData - let browser set it with boundary
      const finalHeaders: Record<string, string> = { 
        ...headers, 
        ...(options.headers as Record<string, string> || {})
      };
      if (options.body instanceof FormData) {
        delete finalHeaders['Content-Type'];
      }

      const config: RequestInit = {
        ...options,
        headers: finalHeaders,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'include', // Include credentials for CORS
      };

      // Request/response logging removed for security

      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail
                .map((e: any) => e.msg || 'Unknown validation error')
                .join(', ');
            } else {
              errorMessage = errorData.detail;
            }
          }
        } catch (e) {
          // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
      }

      return response.json();
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  // User API methods
  async getCurrentUser() {
    return this.makeRequest('/api/v1/users/me/');
  }

  async createUser(userData: { clerk_user_id: string; email: string; first_name?: string; last_name?: string }) {
    return this.makeRequest('/api/v1/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(clerk_user_id: string, userData: { email?: string; first_name?: string; last_name?: string }) {
    return this.makeRequest(`/api/v1/users/${clerk_user_id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // Agent API methods
  async processAgentQuery(query: string, context?: string) {
    return this.makeRequest('/api/v1/process_agent_query', {
      method: 'POST',
      body: JSON.stringify({ query, context }),
    });
  }

  // Graph API methods
  async listGraphs() {
    return this.makeRequest('/api/v1/graphs/');
  }

  async getGraph(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}`);
  }

  async createGraph(graphData: { user_id: string; name: string; emoji?: string; description?: string; colors?: string }) {
    return this.makeRequest('/api/v1/graphs/', {
      method: 'POST',
      body: JSON.stringify(graphData),
    });
  }

  async updateGraph(graphId: string, graphData: { name?: string; emoji?: string; description?: string; colors?: string }) {
    return this.makeRequest(`/api/v1/graphs/${graphId}`, {
      method: 'PUT',
      body: JSON.stringify(graphData),
    });
  }

  async deleteGraph(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}`, {
      method: 'DELETE',
    });
  }

  async getRecentGraphs(limit: number = 10) {
    return this.makeRequest(`/api/v1/graphs/recent/?limit=${limit}`);
  }

  async recordGraphAccess(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/record-access`, {
      method: 'POST',
    });
  }

  async toggleGraphFavorite(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/toggle-favorite`, {
      method: 'POST',
    });
  }

  async duplicateGraph(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/duplicate`, {
      method: 'POST',
    });
  }

  // Node API methods
  async listNodes(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes`);
  }

  async createNode(graphId: string, nodeData: {
    type: 'chat' | 'artefact' | 'asset';
    content_id?: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    title: string;
  }) {
    // Node creation logging removed for security
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(nodeData),
    });
  }

  /**
   * Atomically create a node and its content (chat, artefact, or asset).
   * @param graphId The graph ID
   * @param data The request body (see backend NodeContentCreateRequest)
   * @returns The created node and content
   */
  async createNodeWithContent(graphId: string, data: {
    type: 'chat' | 'artefact' | 'asset';
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    title: string;
    model_used?: string; // for chat
    artefact_type?: string; // for artefact
    current_data?: any; // for artefact
    asset_type?: string; // for asset
    source?: string; // for asset
  }) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes/full-create`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get scraped content for a website node
   * @param graphId The graph ID  
   * @param nodeId The node ID
   * @returns Website content and metadata
   */
  async getWebsiteContent(graphId: string, nodeId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes/${nodeId}/content`, {
      method: 'GET',
    });
  }

  /**
   * Set URL for a website placeholder node and start scraping
   * @param graphId The graph ID
   * @param nodeId The node ID
   * @param url The website URL to set and scrape
   * @returns Scraping result with asset creation info
   */
  async setWebsiteUrl(graphId: string, nodeId: string, url: string) {
    const formData = new FormData();
    formData.append('url', url);
    
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes/${nodeId}/set-website-url`, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Atomically delete a node and its content (chat, artefact, or asset).
   * @param graphId The graph ID
   * @param nodeId The node ID
   * @returns Confirmation and IDs
   */
  async deleteNodeAndContent(graphId: string, nodeId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes/${nodeId}/full-delete`, {
      method: 'DELETE',
    });
  }

  async updateNode(graphId: string, nodeId: string, nodeData: {
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    title?: string;
  }) {
    // Node update logging removed for security
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes/${nodeId}`, {
      method: 'PUT',
      body: JSON.stringify(nodeData),
    });
  }

  async deleteNode(graphId: string, nodeId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
  }

  // Edge API methods
  async listEdges(graphId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/edges`);
  }

  async createEdge(graphId: string, edgeData: {
    source_node_id: string;
    target_node_id: string;
    type: 'DERIVED_FROM';
    source_handle?: string | null;
    target_handle?: string | null;
  }) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/edges`, {
      method: 'POST',
      body: JSON.stringify(edgeData),
    });
  }

  async deleteEdge(graphId: string, edgeId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/edges/${edgeId}`, {
      method: 'DELETE',
    });
  }

  async getEdge(graphId: string, edgeId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/edges/${edgeId}`);
  }

  async updateEdge(graphId: string, edgeId: string, edgeData: {
    source_node_id?: string;
    target_node_id?: string;
    type?: string;
    source_handle?: string | null;
    target_handle?: string | null;
  }) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/edges/${edgeId}`, {
      method: 'PUT',
      body: JSON.stringify(edgeData),
    });
  }

  // Utility: Fetch a single edge (for debugging or future use)
  async fetchSingleEdge(graphId: string, edgeId: string) {
    try {
      const edge = await this.getEdge(graphId, edgeId);
      // Edge logging removed for security
      return edge;
    } catch (err) {
      logger.error('Failed to fetch edge:', err);
      throw err;
    }
  }

  async updateSingleEdge(graphId: string, edgeId: string, edgeData: Partial<{ source_node_id: string; target_node_id: string; type: string; }>) {
    try {
      const updated = await this.updateEdge(graphId, edgeId, edgeData);
      // Edge logging removed for security
      return updated;
    } catch (err) {
      logger.error('Failed to update edge:', err);
      throw err;
    }
  }

  // Content API methods
  async getChatMessages(chatSessionId: string) {
    return this.makeRequest(`/api/v1/chat/${chatSessionId}/messages`);
  }

  async getArtefact(artefactId: string) {
    return this.makeRequest(`/api/v1/artefacts/${artefactId}`);
  }

  async createDocumentArtefact(chatSessionId: string, model?: string, artefactId?: string) {
    const params = new URLSearchParams();
    params.append('chat_session_id', chatSessionId);
    if (model) params.append('model', model);
    if (artefactId) params.append('artefact_id', artefactId);

    const url = `${this.baseURL || ''}/api/v1/artefacts/document?${params.toString()}`;
    
    try {
      const headers = await this.getAuthHeaders();
      
      const config: RequestInit = {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
        },
        mode: 'cors',
        credentials: 'include',
      };

      // Streaming request logging removed for security

      const response = await fetch(url, config);

      // Streaming response logging removed for security

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail
                .map((e: any) => e.msg || 'Unknown validation error')
                .join(', ');
            } else {
              errorMessage = errorData.detail;
            }
          }
        } catch (e) {
          // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async createDocumentArtefactWithOption(chatSessionId: string, selectedOption: any, model?: string, artefactId?: string) {
    const params = new URLSearchParams();
    params.append('chat_session_id', chatSessionId);
    if (model) params.append('model', model);
    if (artefactId) params.append('artefact_id', artefactId);

    const url = `${this.baseURL || ''}/api/v1/artefacts/document?${params.toString()}`;
    const headers = await this.getAuthHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, Accept: 'text/event-stream', 'Content-Type': 'application/json' },
      mode: 'cors',
      credentials: 'include',
      body: JSON.stringify({ selected_option: selectedOption }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response;
  }

  async createTableArtefact(chatSessionId: string, model?: string, artefactId?: string, selectedOption?: any) {
    const params = new URLSearchParams();
    params.append('chat_session_id', chatSessionId);
    if (model) params.append('model', model);
    if (artefactId) params.append('artefact_id', artefactId);

    const url = `${this.baseURL || ''}/api/v1/artefacts/table?${params.toString()}`;
    
    try {
      const headers = await this.getAuthHeaders();
      
      const config: RequestInit = {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        credentials: 'include',
        body: selectedOption ? JSON.stringify({ selected_option: selectedOption }) : undefined,
      };

      // Table streaming request logging removed for security

      const response = await fetch(url, config);

      // Streaming response logging removed for security

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail
                .map((e: any) => e.msg || 'Unknown validation error')
                .join(', ');
            } else {
              errorMessage = errorData.detail;
            }
          }
        } catch (e) {
          // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async getProcessingOptions(chatSessionId: string, outputType: 'table' | 'markdown' | 'mermaid', model?: string, artefactId?: string): Promise<any> {
    const params = new URLSearchParams();
    params.append('chat_session_id', chatSessionId);
    params.append('output_type', outputType);
    if (model) params.append('model', model);
    if (artefactId) params.append('artefact_id', artefactId);

    const url = `${this.baseURL || ''}/api/v1/artefacts/options?${params.toString()}`;

    try {
      const headers = await this.getAuthHeaders();
      const config: RequestInit = {
        method: 'POST',
        headers: { ...headers, Accept: 'text/event-stream' },
        mode: 'cors',
        credentials: 'include',
      };

      const response = await fetch(url, config);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      // Read SSE stream and accumulate function_call arguments/content
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body reader available');

      const decoder = new TextDecoder();
      let buffer = '';
      let aggregated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const evt = JSON.parse(data);
            if (evt && evt.type === 'token' && typeof evt.content === 'string') {
              aggregated += evt.content;
            }
          } catch {
            // not a JSON event – likely raw chunk
            aggregated += data;
          }
        }
      }

      // aggregated should be JSON string for options
      try {
        return JSON.parse(aggregated);
      } catch (e) {
        throw new Error('Failed to parse processing options JSON');
      }
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async createTestDocumentArtefact() {
    const url = `${this.baseURL || ''}/api/v1/artefacts/document/test`;
    
    try {
      const headers = await this.getAuthHeaders();
      
      const config: RequestInit = {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
        },
        mode: 'cors',
        credentials: 'include',
      };

      // Test document streaming request logging removed for security

      const response = await fetch(url, config);

      // Streaming response logging removed for security

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail
                .map((e: any) => e.msg || 'Unknown validation error')
                .join(', ');
            } else {
              errorMessage = errorData.detail;
            }
          }
        } catch (e) {
          // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async createTestTableArtefact() {
    const url = `${this.baseURL || ''}/api/v1/artefacts/table/test`;
    
    try {
      const headers = await this.getAuthHeaders();
      
      const config: RequestInit = {
        method: 'POST',
        headers: {
          ...headers,
          'Accept': 'text/event-stream',
        },
        mode: 'cors',
        credentials: 'include',
      };

      // Test table streaming request logging removed for security

      const response = await fetch(url, config);

      // Streaming response logging removed for security

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              errorMessage = errorData.detail
                .map((e: any) => e.msg || 'Unknown validation error')
                .join(', ');
            } else {
              errorMessage = errorData.detail;
            }
          }
        } catch (e) {
          // Ignore if response is not JSON
        }
        throw new Error(errorMessage);
      }

      return response;
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async createGraphArtefact(
    chatSessionId: string,
    model?: string,
    artefactId?: string,
    previousInvalid?: string,
    previousError?: string,
    selectedOption?: any,
  ) {
    const params = new URLSearchParams();
    params.append('chat_session_id', chatSessionId);
    if (model) params.append('model', model);
    if (artefactId) params.append('artefact_id', artefactId);

    const body: Record<string, any> = {};
    if (typeof previousInvalid === 'string') body.previous_invalid = previousInvalid;
    if (typeof previousError === 'string') body.previous_error = previousError;
    if (selectedOption) body.selected_option = selectedOption;

    return this.makeRequest(`/api/v1/artefacts/graph?${params.toString()}`, {
      method: 'POST',
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
    });
  }

  async createTestGraphArtefact() {
    const url = `${this.baseURL || ''}/api/v1/artefacts/graph/test`;
    try {
      const headers = await this.getAuthHeaders();
      const config: RequestInit = {
        method: 'POST',
        headers: { ...headers, Accept: 'text/event-stream' },
        mode: 'cors',
        credentials: 'include',
      };
      const response = await fetch(url, config);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return response;
    } catch (error) {
      logger.error('API request failed:', error);
      throw error;
    }
  }

  async updateArtefact(artefactId: string, artefactData: any) {
    return this.makeRequest(`/api/v1/artefacts/${artefactId}`, {
      method: 'PUT',
      body: JSON.stringify(artefactData),
    });
  }

  async getAsset(graphId: string, assetId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/assets/${assetId}`);
  }

  // New method: Update asset URL and trigger transcript processing via backend
  async updateAssetUrl(graphId: string, assetId: string, url: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/assets/${assetId}/url`, {
      method: 'PUT',
      body: JSON.stringify({ url }),
    });
  }

  // New method: Upload PDF file directly
  async uploadPdfFile(graphId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return fetch(`${this.baseURL || ''}/api/v1/graphs/${graphId}/assets/upload-pdf`, {
      method: 'POST',
      // No Authorization header needed - Next.js API route handles authentication via Clerk
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return response.json();
    });
  }

  // New method: Upload PDF file directly to an existing asset
  async uploadPdfToAsset(graphId: string, assetId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return fetch(`${this.baseURL || ''}/api/v1/graphs/${graphId}/assets/${assetId}/upload-file`, {
      method: 'POST',
      // No Authorization header needed - Next.js API route handles authentication via Clerk
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return response.json();
    });
  }

  // New method: Get asset with transcript
  async getAssetWithTranscript(graphId: string, assetId: string) {
    return this.makeRequest(`/api/v1/graphs/${graphId}/assets/${assetId}`, {
      method: 'GET',
    });
  }

  // New method: Create asset from placeholder PDF node
  async createAssetFromPlaceholder(graphId: string, placeholderId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('placeholder_id', placeholderId);

    if (!this.getToken) {
      throw new Error('Authentication not configured');
    }

    const token = await this.getToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return fetch(`${this.baseURL}/api/v1/graphs/${graphId}/assets/create-from-placeholder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      return response.json();
    });
  }
}

export const apiClient = new ApiClient();

 