"use client";

import React, { useEffect, useRef, useState } from "react";
import { BarChart2 } from "lucide-react";
import { GraphNodeData } from '../types';
import { NODE_COLORS } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import { FullScreenButton } from '../ui/FullScreenButton';
import { useApiClient } from "@/lib/useApiClient";
import mermaid from "mermaid";
import { ProcessingOptionsModal } from '@/components/ProcessingOptionsModal';
import { logger } from '@/lib/logger';

interface GraphNodeContentProps {
  nodeId: string;
  nodeData: GraphNodeData;
  selected: boolean;
}

export function GraphNodeContent({ nodeId, nodeData, selected }: GraphNodeContentProps) {
  const headerStyle = getNodeHeaderStyle('GRAPH');
  const contentStyle = getNodeContentStyle('GRAPH');
  const containerStyle = getStickyNoteStyle('GRAPH', selected);

  const apiClient = useApiClient();
  const [localContent, setLocalContent] = useState<string>(nodeData.content || '');
  const [isLoading, setIsLoading] = useState<boolean>(nodeData.isLoading || false);
  const [error, setError] = useState<string | null>(nodeData.error || null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [charactersReceived, setCharactersReceived] = useState<number>(0);
  const requestInProgressRef = useRef<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  // const renderCountRef = useRef<number>(0);
  const streamChunkCountRef = useRef<number>(0);
  const totalBytesRef = useRef<number>(0);
  const startedAtRef = useRef<number>(0);
  const scheduledRenderTimeoutRef = useRef<number | null>(null);
  const latestVersionRef = useRef<number>(0);
  const lastRenderedLengthRef = useRef<number>(0);
  const startedKeyRef = useRef<string | null>(null);
  const autoRetryDoneRef = useRef<boolean>(false);
  const lastMermaidErrorRef = useRef<string | null>(null);
  const lastInvalidMermaidRef = useRef<string | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsPayload, setOptionsPayload] = useState<any | null>(null);
  const selectedOptionRef = useRef<any | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Auto-scroll to bottom when content updates during streaming
  useEffect(() => {
    if (isLoading && localContent && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [localContent, isLoading]);

  // Initialize Mermaid once
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      logger.log('[GraphNode] Mermaid initialized', { nodeId, theme: 'neutral' });
    } catch {
      // ignore
    }
  }, [nodeId]);

  // Throttled render during streaming to avoid UI freezes
  useEffect(() => {
    if (!localContent || !diagramContainerRef.current) {
      setRenderedSvg("");
      return;
    }

        const scheduleRender = () => {
      if (scheduledRenderTimeoutRef.current) {
        window.clearTimeout(scheduledRenderTimeoutRef.current);
      }
      scheduledRenderTimeoutRef.current = window.setTimeout(async () => {
        const currentVersion = ++latestVersionRef.current;
            // No programmatic content fixes; use exact string as provided
            const contentToRender = localContent;
        const lengthToRender = contentToRender.length;
        const t0 = performance.now();
        try {
          // Pre-validate content with Mermaid parser; if it throws, treat as syntax error
          try {
            // Some mermaid versions expose parse() sync; wrap in try/catch without await
            type MermaidWithParse = typeof mermaid & { parse?: (code: string) => void };
            const mermaidWithParse = mermaid as MermaidWithParse;
            if (typeof mermaidWithParse.parse === 'function') {
              mermaidWithParse.parse(contentToRender);
            }
          } catch (parseErr: unknown) {
            const errObj = parseErr as { str?: string; message?: string } | undefined;
            const message = errObj?.str || errObj?.message || 'Unknown Mermaid syntax error';
            if (currentVersion === latestVersionRef.current) {
              setRenderedSvg('');
              setError(`Mermaid syntax error: ${message}`);
              lastMermaidErrorRef.current = `Mermaid syntax error: ${message}`;
              lastInvalidMermaidRef.current = contentToRender;
              try {
                // Log the exact line tokens around the failure for debugging newline collapsing
                const lines = contentToRender.split('\n');
                const preview = lines.map((l, i) => `${i + 1}: ${JSON.stringify(l)}`).slice(0, 40);
                logger.warn('[GraphNode] Mermaid parse error context (first 40 lines):', preview);
              } catch {
                // ignore
              }
            }
            const t1 = performance.now();
            logger.warn('[GraphNode] Mermaid parse failed prior to render', {
              nodeId,
              contentLength: lengthToRender,
              durationMs: Math.round(t1 - t0),
              error: message,
            });
            return;
          }

          // Submit exact string to Mermaid renderer without any transformation
          let svg: string;
          try {
            const renderResult = await mermaid.render(`mermaid-${nodeId}`, contentToRender);
            svg = renderResult.svg;
            // Double-check for error patterns in the result before proceeding
            const svgTest = (svg || '').toLowerCase();
            if (svgTest.includes('error') || svgTest.includes('syntax')) {
              throw new Error('Mermaid produced error SVG');
            }
          } catch (renderError) {
            // If render fails or produces error SVG, prevent it from being displayed
            if (currentVersion === latestVersionRef.current) {
              setRenderedSvg('');
              const message = renderError instanceof Error ? renderError.message : 'Mermaid render failed';
              setError(`Mermaid syntax error: ${message}`);
              lastMermaidErrorRef.current = `Mermaid syntax error: ${message}`;
              lastInvalidMermaidRef.current = contentToRender;
            }
            return;
          }
          // Apply only if still latest
          if (currentVersion === latestVersionRef.current) {
            // Detect Mermaid error SVGs and suppress them (bomb icon, error markers, etc.)
            const svgLower = (svg || '').toLowerCase();
            const isErrorSvg =
              typeof svg === 'string' && (
                svg.includes('Syntax error in text') ||
                svg.includes('Syntax error in graph') ||
                svg.includes('syntax error') ||
                svg.includes('Parse error') ||
                svg.includes('parse error') ||
                svgLower.includes('class="error-icon"') ||
                svgLower.includes('class="error-text"') ||
                svgLower.includes('class="error"') ||
                svgLower.includes('data-parse-error') ||
                svgLower.includes('mermaid version') ||
                svgLower.includes('error-marker') ||
                svgLower.includes('<path class="error-icon"') ||
                svgLower.includes('<text class="error-text"') ||
                svgLower.includes('__web-inspector-hide-shortcut__') ||
                (svg.includes('<g>') && (svg.includes('error-icon') || svg.includes('error-text')))
              );

            if (isErrorSvg) {
              setRenderedSvg('');
              setError('Mermaid syntax error: diagram failed to render.');
              lastMermaidErrorRef.current = 'Mermaid syntax error: diagram failed to render.';
              lastInvalidMermaidRef.current = contentToRender;
              // Clean up any error SVGs that might have been added to DOM
              setTimeout(() => {
                const errorSvgs = document.querySelectorAll('svg[id*="mermaid"] .error-icon, svg[id*="mermaid"] .error-text, svg[class*="web-inspector-hide-shortcut"]');
                errorSvgs.forEach(el => {
                  const svgParent = el.closest('svg');
                  if (svgParent) svgParent.remove();
                });
              }, 0);
            } else {
              setRenderedSvg(svg);
              // Clear any previous error once we have a good render
              setError(null);
              lastMermaidErrorRef.current = null;
              lastInvalidMermaidRef.current = null;
            }
            lastRenderedLengthRef.current = lengthToRender;
            const t1 = performance.now();
            logger.log('[GraphNode] Throttled Mermaid render success', {
              nodeId,
              contentLength: lengthToRender,
              durationMs: Math.round(t1 - t0),
            });
          } else {
            logger.log('[GraphNode] Skipped outdated render result', { nodeId, currentVersion, latest: latestVersionRef.current });
          }
          } catch (e) {
          // Keep last successful SVG on error (avoid flicker to raw text)
          const t1 = performance.now();
          logger.warn('[GraphNode] Throttled Mermaid render failed, keeping raw text', {
            nodeId,
            contentLength: lengthToRender,
            durationMs: Math.round(t1 - t0),
            error: e instanceof Error ? e.message : String(e),
          });
          if (currentVersion === latestVersionRef.current) {
            setRenderedSvg('');
            setError(
              `Mermaid render error: ${e instanceof Error ? e.message : String(e)}`
            );
            lastMermaidErrorRef.current = `Mermaid render error: ${e instanceof Error ? e.message : String(e)}`;
            lastInvalidMermaidRef.current = contentToRender;
              try {
                const dbgLines = contentToRender.split('\n').map((l, i) => `${i + 1}: ${JSON.stringify(l)}`);
                logger.warn('[GraphNode] Mermaid render error context (first 60 lines):', dbgLines.slice(0, 60));
              } catch {}
          }
        }
      }, isLoading ? 300 : 0);
    };

    // During streaming: throttle renders; after streaming: render immediately
    if (isLoading) {
      // Only schedule if content grew meaningfully to avoid too many renders
      if (localContent.length - lastRenderedLengthRef.current >= 50) {
        scheduleRender();
      }
    } else {
      scheduleRender();
    }

    return () => {
      if (scheduledRenderTimeoutRef.current) {
        window.clearTimeout(scheduledRenderTimeoutRef.current);
        scheduledRenderTimeoutRef.current = null;
      }
    };
  }, [localContent, nodeId, isLoading]);

  // Broadcast content updates to full screen component
  useEffect(() => {
    const event = new CustomEvent('graph-content-update', {
      detail: {
        nodeId: nodeId,
        content: localContent,
        isLoading: isLoading,
        error: error,
        charactersReceived: charactersReceived,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
    if (charactersReceived % 200 === 0) {
      logger.log('[GraphNode] Broadcast graph-content-update', {
        nodeId,
        isLoading,
        errorPresent: !!error,
        charactersReceived,
        contentLength: localContent?.length || 0,
        timestamp: new Date().toISOString(),
      });
    }
  }, [nodeId, localContent, isLoading, error, charactersReceived]);

  // Load processing options from database if available (for modal persistence on reload)
  useEffect(() => {
    if (nodeData.processingOptions && !optionsPayload) {
      logger.log('[GraphNode] Loading saved processing options from database', {
        nodeId,
        processingOptions: nodeData.processingOptions,
        selectedOption: nodeData.selectedProcessingOption,
        outputType: nodeData.processingOutputType,
      });
      setOptionsPayload(nodeData.processingOptions);
      if (nodeData.selectedProcessingOption) {
        selectedOptionRef.current = { 
          chatSessionId: null, // Will be set when edge is created
          selectedOption: nodeData.selectedProcessingOption 
        };
      }
      // Show modal if we have options but no content yet and no option was previously selected
      if (!localContent && !nodeData.content && nodeData.processingOptions?.options?.length > 0 && !nodeData.selectedProcessingOption) {
        setShowOptionsModal(true);
      }
    }
  }, [nodeData.processingOptions, nodeData.selectedProcessingOption, nodeData.processingOutputType, optionsPayload, nodeId]);

  // Listen for chat-to-graph edge creation events
  useEffect(() => {
    const handleUpdateGraphNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      logger.log('[GraphNode] EVENT: Received update-graph-node', {
        eventNodeId,
        chatSessionId,
        currentNodeId: nodeId,
        hasExistingChatSession: !!nodeData.chatSessionId,
        timestamp: new Date().toISOString(),
      });
      if (eventNodeId === nodeId && chatSessionId && !nodeData.chatSessionId) {
        // fetch processing options for mermaid and show modal
        (async () => {
          try {
            setOptionsLoading(true);
            const opts = await apiClient.getProcessingOptions(chatSessionId, 'mermaid', undefined, nodeData.artefactId);
            setOptionsPayload(opts);
            setShowOptionsModal(true);
            // Preserve any existing selectedOption from database when updating chatSessionId
            selectedOptionRef.current = { 
              chatSessionId,
              selectedOption: selectedOptionRef.current?.selectedOption 
            };
          } catch (e) {
            logger.error('[GraphNode] Failed to get processing options, falling back', e);
            const updateEvent = new CustomEvent('graph-node-chat-session-update', { detail: { nodeId, chatSessionId } });
            window.dispatchEvent(updateEvent);
          } finally {
            setOptionsLoading(false);
          }
        })();
      }
    };
    window.addEventListener('update-graph-node', handleUpdateGraphNode);
    return () => window.removeEventListener('update-graph-node', handleUpdateGraphNode);
  }, [nodeId, nodeData.chatSessionId]);

  // Load existing artefact data
  useEffect(() => {
    if (nodeData.artefactId && !localContent) {
      const loadArtefact = async () => {
        try {
          setIsLoading(true);
          setError(null);
          logger.log('[GraphNode] Loading existing artefact', {
            nodeId,
            artefactId: nodeData.artefactId,
            timestamp: new Date().toISOString(),
          });
          const artefact = await apiClient.getArtefact(nodeData.artefactId! as string) as { current_data?: { mermaid?: string } };
          // Log the raw backend response used to populate this graph node
          logger.log('[GraphNode] Backend artefact response (getArtefact)', {
            nodeId,
            artefactId: nodeData.artefactId,
            artefact,
          });
          if (artefact.current_data?.mermaid) {
            setLocalContent(artefact.current_data.mermaid);
            logger.log('[GraphNode] Loaded artefact content', {
              nodeId,
              artefactId: nodeData.artefactId,
              contentLength: artefact.current_data.mermaid.length,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load artefact');
          logger.error('[GraphNode] Failed to load artefact', {
            nodeId,
            artefactId: nodeData.artefactId,
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          setIsLoading(false);
        }
      };
      loadArtefact();
    }
  }, [nodeData.artefactId, localContent, apiClient, nodeId]);

  // Create graph artefact from chat session (non-streaming, only if no existing content)
  useEffect(() => {
    if (nodeData.chatSessionId && !isLoading && !requestInProgressRef.current && !localContent && !nodeData.content) {
      // Prevent duplicate stream runs for the same parameters
      const startKey = `${nodeId}|${nodeData.chatSessionId}|${nodeData.artefactId || ''}|${retryCount}`;
      if (startedKeyRef.current === startKey) {
        return;
      }
      startedKeyRef.current = startKey;
      // Reset auto-retry guard for this generation attempt
      autoRetryDoneRef.current = false;
      const createGraph = async () => {
        requestInProgressRef.current = true;
        const timeoutId = setTimeout(() => {
          setError('Graph generation timed out. Please try again.');
          setIsLoading(false);
          requestInProgressRef.current = false;
          logger.error('[GraphNode] Graph generation timed out', {
            nodeId,
            chatSessionId: nodeData.chatSessionId,
            elapsedMs: 60000,
          });
        }, 60000);
        try {
          setIsLoading(true);
          setError(null);
          setLocalContent('');
          setCharactersReceived(0);
          streamChunkCountRef.current = 0;
          totalBytesRef.current = 0;
          startedAtRef.current = performance.now();
          logger.log('[GraphNode] Starting graph artefact generation (non-streaming)', {
            nodeId,
            chatSessionId: nodeData.chatSessionId,
            artefactId: nodeData.artefactId || null,
            retryCount,
            hasPreviousInvalid: !!lastInvalidMermaidRef.current,
            previousInvalidLength: lastInvalidMermaidRef.current?.length || 0,
            previousMermaidError: lastMermaidErrorRef.current || null,
            timestamp: new Date().toISOString(),
          });
          const artefact = await apiClient.createGraphArtefact(
            nodeData.chatSessionId!,
            undefined,
            nodeData.artefactId || undefined,
            lastInvalidMermaidRef.current || undefined,
            lastMermaidErrorRef.current || undefined,
          ) as unknown as { current_data?: { mermaid?: string } };
          // Log the raw backend response used to generate the artefact
          logger.log('[GraphNode] Backend artefact response (createGraphArtefact)', {
            nodeId,
            chatSessionId: nodeData.chatSessionId,
            artefact,
          });
          const mermaid = artefact.current_data?.mermaid || '';
          setLocalContent(mermaid);
          setCharactersReceived(mermaid.length);
          const elapsedMs = Math.round(performance.now() - startedAtRef.current);
          logger.log('[GraphNode] Graph generation complete', {
            nodeId,
            contentLength: mermaid.length,
            elapsedMs,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to create graph');
          logger.error('[GraphNode] Failed to create graph artefact', {
            nodeId,
            chatSessionId: nodeData.chatSessionId,
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          setIsLoading(false);
          requestInProgressRef.current = false;
          clearTimeout(timeoutId);
          logger.log('[GraphNode] Stream cleanup complete', {
            nodeId,
            chatSessionId: nodeData.chatSessionId,
            isLoading: false,
            timestamp: new Date().toISOString(),
          });
        }
      };
      createGraph();
    }
  }, [nodeData.chatSessionId, nodeData.artefactId, apiClient, isLoading, nodeId, retryCount]);

  // Auto-regenerate once if a Mermaid-specific render/parse error occurs
  useEffect(() => {
    if (
      error &&
      !isLoading &&
      nodeData.chatSessionId &&
      !autoRetryDoneRef.current &&
      typeof error === 'string' &&
      error.toLowerCase().includes('mermaid') &&
      retryCount < 3
    ) {
      autoRetryDoneRef.current = true;
      logger.log('[GraphNode] Auto-retrying graph generation due to Mermaid error', {
        nodeId,
        retryCount,
        errorMessage: typeof error === 'string' ? error : String(error),
        previousInvalidLength: lastInvalidMermaidRef.current?.length || 0,
      });
      setError(null);
      setRetryCount((prev) => prev + 1);
    }
  }, [error, isLoading, nodeData.chatSessionId, retryCount, nodeId]);

  return (
      <div className={containerStyle.className} style={containerStyle.style}>
      <div className="h-full flex flex-col relative z-10">
        <div className={headerStyle.className} style={headerStyle.style}>
          <div className="text-sm font-semibold flex items-center justify-between" style={{ color: NODE_COLORS.GRAPH.textColor }}>
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              {nodeData.label}
            </div>
            <FullScreenButton nodeId={nodeId} />
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: NODE_COLORS.GRAPH.textColor, opacity: 0.8 }}>Graph</div>
        </div>
        <div className="flex-1 overflow-auto w-full p-4 min-h-0" style={contentStyle.style}>
          {showOptionsModal ? (
            <div className="w-full">
              <ProcessingOptionsModal
                isOpen={true}
                onClose={() => {
                  setShowOptionsModal(false);
                  const removeEvent = new CustomEvent('remove-node', { detail: { nodeId } });
                  window.dispatchEvent(removeEvent);
                }}
                options={optionsPayload?.options || []}
                detectedSubjects={optionsPayload?.detected_subjects}
                outputType={'mermaid'}
                nodeId={nodeId}
                isNodeSelected={selected}
                inline
                onSelect={async (opt) => {
                  setShowOptionsModal(false);
                  try {
                    const chatSessionId = selectedOptionRef.current?.chatSessionId || nodeData.chatSessionId;
                    if (!chatSessionId) {
                      setError('Please connect this graph to a chat session by creating an edge from a chat node to this graph node');
                      return;
                    }
                    const artefact = await apiClient.createGraphArtefact(
                      chatSessionId,
                      undefined,
                      nodeData.artefactId || undefined,
                      undefined,
                      undefined,
                      opt,
                    ) as unknown as { current_data?: { mermaid?: string } };
                    const mermaidSrc = artefact.current_data?.mermaid || '';
                    setLocalContent(mermaidSrc);
                    setCharactersReceived(mermaidSrc.length);
                  } catch (e) {
                    logger.error('[GraphNode] Error generating mermaid with selected option', e);
                    setError(e instanceof Error ? e.message : 'Failed to generate graph');
                  }
                }}
              />
            </div>
          ) : error ? (
            <div className="flex flex-col gap-3 w-full h-full">
              <div className="flex items-center gap-2" style={{ color: '#dc2626' }}>
                <span className="text-sm">{error}</span>
                {retryCount < 3 && (
                  <button
                    onClick={() => {
                      logger.log('[GraphNode] Manual retry requested for Mermaid error', {
                        nodeId,
                        currentRetryCount: retryCount,
                        nextRetryCount: retryCount + 1,
                        errorMessage: typeof error === 'string' ? error : String(error),
                        previousInvalidLength: lastInvalidMermaidRef.current?.length || 0,
                      });
                      setError(null);
                      setRetryCount(prev => prev + 1);
                    }}
                    className="px-3 py-1 text-xs text-white rounded hover:opacity-80 transition-all"
                    style={{ backgroundColor: NODE_COLORS.GRAPH.border }}
                  >
                    Retry ({3 - retryCount} attempts left)
                  </button>
                )}
              </div>
              {localContent && (
                <div className="flex-1 overflow-auto" ref={contentRef}>
                  {/* Show the current Mermaid text so the user can see what's failing */}
                  <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300 text-sm">
                    <code>{localContent}</code>
                  </pre>
                </div>
              )}
            </div>
          ) : (isLoading || optionsLoading) ? (
            <div className="w-full h-full flex flex-col">
              {localContent && (
                <div className="flex-1 overflow-auto" ref={contentRef}>
                  <div ref={diagramContainerRef} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
                  {!renderedSvg && (
                    <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300 text-sm">
                      <code>{localContent}</code>
                    </pre>
                  )}
                  <span className="inline-block w-0.5 h-5 bg-gray-800 animate-pulse ml-1 align-text-bottom"></span>
                </div>
              )}
              <div className="flex items-center gap-2 py-2 border-t" style={{ color: NODE_COLORS.GRAPH.textColor, borderColor: NODE_COLORS.GRAPH.border, opacity: 0.7 }}>
                <span className="text-sm">
                  {optionsLoading ? 'Loading suggestions...' : (localContent ? 'Generating graph...' : 'Loading graph...')}
                </span>
                {localContent && (
                  <span className="text-xs ml-2" style={{ opacity: 0.6 }}>
                    {charactersReceived} characters generated
                  </span>
                )}
              </div>
            </div>
          ) : localContent ? (
            <div className="w-full h-full overflow-auto" ref={contentRef}>
              <div ref={diagramContainerRef} dangerouslySetInnerHTML={{ __html: renderedSvg }} />
              {!renderedSvg && (
                <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300 text-sm">
                  <code>{localContent}</code>
                </pre>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4" style={{ color: NODE_COLORS.GRAPH.textColor, opacity: 0.7 }}>
              <div className="text-lg font-semibold text-center">
                No graph content.
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Inline options rendered above when open */}
    </div>
  );
} 