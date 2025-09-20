"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BarChart2, X, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { GraphNodeData } from '../types';
import { useFullScreen } from '../context/FullScreenContext';
import mermaid from 'mermaid';
import { useApiClient } from '@/lib/useApiClient';
import { ProcessingOptionsModal } from '@/components/ProcessingOptionsModal';
import { logger } from '@/lib/logger';

interface FullScreenGraphProps {
  nodeData: GraphNodeData;
  nodeId: string;
}

export function FullScreenGraph({ nodeData, nodeId }: FullScreenGraphProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const apiClient = useApiClient();

  const [localContent, setLocalContent] = useState<string>(nodeData.content || '');
  const [isLoading, setIsLoading] = useState<boolean>(nodeData.isLoading || false);
  const [error, setError] = useState<string | null>(nodeData.error || null);
  const [charactersReceived, setCharactersReceived] = useState<number>(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1.5); // Start more zoomed in
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [graphDimensions, setGraphDimensions] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsPayload, setOptionsPayload] = useState<any | null>(null);
  const selectedOptionRef = useRef<any | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const scheduledRenderTimeoutRef = useRef<number | null>(null);
  const latestVersionRef = useRef<number>(0);
  const lastRenderedLengthRef = useRef<number>(0);
  const renderIdRef = useRef<string>(`mermaid-fullscreen-${nodeId}-${Math.random().toString(36).slice(2)}`);

  const handleClose = () => setFullScreenNodeId(null);
  
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 12)); // 800% of 1.5 baseline
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  }, []);
  
  const centerGraph = useCallback(() => {
    setPan({ x: 0, y: 0 });
  }, []);
  
  const handleResetZoom = useCallback(() => {
    setZoom(1.5);
    centerGraph();
  }, [centerGraph]);
  
  // Mouse drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y
    });
    e.preventDefault();
  }, [pan.x, pan.y]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPan({
      x: dragStart.panX + deltaX,
      y: dragStart.panY + deltaY
    });
  }, [isDragging, dragStart.x, dragStart.y, dragStart.panX, dragStart.panY]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom(prev => Math.min(Math.max(prev + delta, 0.25), 12));
  }, []);

  // Auto-scroll while streaming
  useEffect(() => {
    if (isLoading && localContent && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [localContent, isLoading]);

  // Initialize Mermaid once
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
    } catch {}
  }, [nodeId]);

  // If we missed live updates, load artefact content directly when available
  useEffect(() => {
    if (nodeData.artefactId && !localContent) {
      const loadArtefact = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const artefact = await apiClient.getArtefact(nodeData.artefactId! as string) as { current_data?: { mermaid?: string } };
          const mermaidText = artefact.current_data?.mermaid || '';
          if (mermaidText) {
            setLocalContent(mermaidText);
            setCharactersReceived(mermaidText.length);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load artefact');
        } finally {
          setIsLoading(false);
        }
      };
      loadArtefact();
    }
  }, [nodeData.artefactId, localContent, apiClient]);
  
  // Keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetZoom();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y + 20 }));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setPan(prev => ({ ...prev, y: prev.y - 20 }));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x + 20 }));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setPan(prev => ({ ...prev, x: prev.x - 20 }));
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom, setPan]);

  // Load processing options from database if available
  useEffect(() => {
    if (nodeData.processingOptions && !optionsPayload) {
      setOptionsPayload(nodeData.processingOptions);
      if (nodeData.selectedProcessingOption) {
        selectedOptionRef.current = { 
          chatSessionId: null,
          selectedOption: nodeData.selectedProcessingOption 
        };
      }
      if (!localContent && !nodeData.content && nodeData.processingOptions?.options?.length > 0 && !nodeData.selectedProcessingOption) {
        setShowOptionsModal(true);
      }
    }
  }, [nodeData.processingOptions, nodeData.selectedProcessingOption, optionsPayload, nodeId, localContent, nodeData.content]);

  // Listen for real-time content updates from GraphNode
  useEffect(() => {
    const handleContentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, content, isLoading: nodeIsLoading, error: nodeError, charactersReceived: nodeCharactersReceived } = customEvent.detail || {};
      if (eventNodeId === nodeId) {
        setLocalContent(content || '');
        setIsLoading(!!nodeIsLoading);
        setError(nodeError || null);
        setCharactersReceived(nodeCharactersReceived || 0);
      }
    };

    window.addEventListener('graph-content-update', handleContentUpdate);
    return () => window.removeEventListener('graph-content-update', handleContentUpdate);
  }, [nodeId]);

  // Render Mermaid with throttling similar to node view
  useEffect(() => {
    if (!localContent) {
      setRenderedSvg("");
      return;
    }

    const scheduleRender = () => {
      if (scheduledRenderTimeoutRef.current) {
        window.clearTimeout(scheduledRenderTimeoutRef.current);
      }
      scheduledRenderTimeoutRef.current = window.setTimeout(async () => {
        const currentVersion = ++latestVersionRef.current;
        const contentToRender = localContent;
        const lengthToRender = contentToRender.length;
        try {
          // Pre-validate (if available)
          type MermaidWithParse = typeof mermaid & { parse?: (code: string) => void };
          const mermaidWithParse = mermaid as MermaidWithParse;
          try {
            if (typeof mermaidWithParse.parse === 'function') {
              mermaidWithParse.parse(contentToRender);
            }
          } catch (parseErr: unknown) {
            if (currentVersion === latestVersionRef.current) {
              setRenderedSvg('');
              const message = (parseErr as any)?.str || (parseErr as any)?.message || 'Unknown Mermaid syntax error';
              setError(`Mermaid syntax error: ${message}`);
            }
            return;
          }
          const renderKey = `${renderIdRef.current}-${currentVersion}`;
          const { svg } = await mermaid.render(renderKey, contentToRender);
          if (currentVersion === latestVersionRef.current) {
            const svgLower = (svg || '').toLowerCase();
            const isErrorSvg = typeof svg === 'string' && (
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
              setError(null);
              // Ensure the rendered SVG stays visible by not clearing on subsequent schedules unless content changes
              lastRenderedLengthRef.current = lengthToRender;
            }
          }
        } catch (e) {
          if (currentVersion === latestVersionRef.current) {
            setRenderedSvg('');
            setError(`Mermaid render error: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }, isLoading ? 300 : 0);
    };

    const diff = localContent.length - lastRenderedLengthRef.current;
    const shouldForceFirstRender = !renderedSvg && localContent.length > 0;
    if (isLoading) {
      if (diff >= 50 || shouldForceFirstRender) {
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

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-violet-50">
        <div className="text-lg font-medium text-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-5 w-5 text-violet-600" />
            <span className="text-gray-900">{nodeData.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-200"
                title="Zoom Out"
                disabled={zoom <= 0.25}
              >
                <ZoomOut className="h-4 w-4 text-gray-600" />
              </button>
              <span className="px-2 text-sm text-gray-600 font-medium min-w-[3rem] text-center">
                {Math.round((zoom / 1.5) * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-200"
                title="Zoom In"
                disabled={zoom >= 12}
              >
                <ZoomIn className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-200"
                title="Reset Zoom & Pan"
              >
                <RotateCcw className="h-4 w-4 text-gray-600" />
              </button>
              <div className="w-px h-6 bg-gray-200 mx-1"></div>
              <button
                onClick={centerGraph}
                className="p-1.5 rounded hover:bg-gray-100 transition-colors duration-200"
                title="Center Graph"
              >
                <Move className="h-4 w-4 text-gray-600" />
              </button>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              title="Close full screen"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
          </div>
        </div>
        <div className="text-sm text-violet-600 font-semibold mt-1">Graph</div>
        <div className="text-xs text-gray-500 mt-1">
          Drag to pan • Scroll to zoom • Arrow keys to move • +/- to zoom • 0 to reset
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showOptionsModal ? (
          <div className="p-8">
            <ProcessingOptionsModal
              isOpen={true}
              onClose={() => {
                setShowOptionsModal(false);
                handleClose();
              }}
              options={optionsPayload?.options || []}
              detectedSubjects={optionsPayload?.detected_subjects}
              outputType={'mermaid'}
              nodeId={nodeId}
              isNodeSelected={true}
              inline
              onSelect={async (opt) => {
                setShowOptionsModal(false);
                // Implement graph generation with selected option
                logger.log('Graph option selected:', opt);
              }}
            />
          </div>
        ) : isLoading || optionsLoading ? (
          <div className="w-full h-full flex flex-col">
            {localContent && (
              <div className="flex-1 overflow-auto" ref={contentRef}>
                <div 
                  ref={viewportRef}
                  className="p-8 flex justify-center items-center overflow-hidden relative h-full"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onWheel={handleWheel}
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                  <div 
                    ref={diagramContainerRef} 
                    style={{ 
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: 'center',
                      transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                      userSelect: 'none'
                    }}
                    dangerouslySetInnerHTML={{ __html: renderedSvg }} 
                  />
                  {!renderedSvg && (
                    <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300 text-sm">
                      <code>{localContent}</code>
                    </pre>
                  )}
                  <span className="inline-block w-0.5 h-5 bg-gray-800 animate-pulse ml-1 align-text-bottom"></span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-700 py-2 border-t border-gray-200 px-8">
              <span className="text-sm">
                {optionsLoading ? 'Loading suggestions...' : (localContent ? 'Generating graph...' : 'Loading graph...')}
              </span>
              {localContent && (
                <span className="text-xs text-gray-500 ml-2">
                  {charactersReceived} characters generated
                </span>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col gap-3 w-full h-full p-8">
            <div className="flex items-center gap-2" style={{ color: '#dc2626' }}>
              <span className="text-sm">{error}</span>
            </div>
            {localContent && (
              <div className="flex-1 overflow-auto" ref={contentRef}>
                <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300 text-sm">
                  <code>{localContent}</code>
                </pre>
              </div>
            )}
          </div>
        ) : localContent ? (
          <div 
            ref={viewportRef}
            className="p-8 flex justify-center items-center overflow-hidden relative h-full"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div 
              ref={diagramContainerRef} 
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                userSelect: 'none'
              }}
              dangerouslySetInnerHTML={{ __html: renderedSvg }} 
            />
            {!renderedSvg && (
              <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300 text-sm">
                <code>{localContent}</code>
              </pre>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-gray-700 p-8">
            <div className="text-lg font-semibold text-center">
              No graph content.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}