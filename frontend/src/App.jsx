import { useEffect, useMemo, useState } from 'react';

import './App.css';

/* =========================
   API CONFIG
========================= */

// const API_URL =
//   import.meta.env.VITE_API_URL ||
//   (window.location.hostname === 'localhost' ||
//   window.location.hostname === '127.0.0.1'
//     ? 'http://localhost:3002/api/convert'
//     : 'https://eds-block-converter.onrender.com/api/convert');

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3002'
    : 'https://eds-block-converter.onrender.com');

/* =========================
   JSON FORMATTER
========================= */

function formatJson(data) {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data || '');
  }
}

/* =========================
   HTML FORMATTER
========================= */

function formatHtml(html) {
  if (!html) {
    return '';
  }

  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);

  const normalized = html
    .replace(/\r\n/g, '\n')
    .replace(/\n+/g, '')
    .replace(/>\s+</g, '><')
    .replace(/></g, '>\n<');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let indent = 0;

  return lines
    .map((line) => {
      const closingTag = line.match(
        /^<\/([a-zA-Z][\w-]*)/
      );

      const openingTag = line.match(
        /^<([a-zA-Z][\w-]*)\b/
      );

      const isClosing = Boolean(closingTag);

      const tagName =
        closingTag?.[1] ||
        openingTag?.[1] ||
        '';

      const isSelfClosing =
        /\/>$/.test(line) ||
        voidTags.has(tagName.toLowerCase());

      if (isClosing) {
        indent = Math.max(0, indent - 1);
      }

      const formatted =
        '  '.repeat(indent) + line;

      if (
        openingTag &&
        !isClosing &&
        !isSelfClosing &&
        !line.includes('</')
      ) {
        indent += 1;
      }

      return formatted;
    })
    .join('\n');
}

/* =========================
   FILE DOWNLOAD
========================= */

function downloadFile(
  content,
  filename,
  type
) {
  const blob = new Blob(
    [content],
    { type }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

/* =========================
   MAIN APP
========================= */

function App() {
  const [file, setFile] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [loadingText, setLoadingText] =
    useState(
      'Preparing your document...'
    );

  const [result, setResult] =
    useState(null);

  const [error, setError] =
    useState('');

  const [activeBlock, setActiveBlock] =
    useState(null);

  const [activeView, setActiveView] =
    useState('json');

  const [copied, setCopied] =
    useState(false);

  /* =========================
     LOADER MESSAGES
  ========================= */

  useEffect(() => {
    if (!loading) {
      return;
    }

    const messages = [
      'Reading DOCX document...',
      'Extracting document content...',
      'Detecting EDS blocks...',
      'Generating XWalk configuration...',
      'Building block models...',
      'Formatting JSON...',
      'Formatting HTML...',
      'Almost ready...',
    ];

    let index = 0;

    setLoadingText(messages[0]);

    const timer =
      setInterval(() => {
        index =
          (index + 1) %
          messages.length;

        setLoadingText(
          messages[index]
        );
      }, 850);

    return () =>
      clearInterval(timer);
  }, [loading]);

  /* =========================
     FILE SELECT
  ========================= */

  function handleFileChange(event) {
    const selectedFile =
      event.target.files?.[0];

    setError('');
    setResult(null);
    setActiveBlock(null);
    setCopied(false);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith('.docx')
    ) {
      setFile(null);

      setError(
        'Please select a DOCX file.'
      );

      return;
    }

    setFile(selectedFile);
  }

  /* =========================
     CONVERT
  ========================= */

  async function handleConvert() {
    if (!file) {
      setError(
        'Please select a DOCX file first.'
      );

      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setActiveBlock(null);
    setCopied(false);

    try {
      const formData =
        new FormData();

      formData.append(
        'file',
        file
      );

      console.log(
        'Calling API:',
        API_URL
      );

      const response =
        await fetch(API_URL, {
          method: 'POST',
          body: formData,
        });

      let data;

      try {
        data =
          await response.json();
      } catch {
        throw new Error(
          'Backend returned an invalid response.'
        );
      }

      console.log(
        'Backend response:',
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Conversion failed.'
        );
      }

      /*
       * IMPORTANT:
       *
       * Backend response is used directly.
       *
       * Frontend does NOT:
       * - change component
       * - change field name
       * - change label
       * - create hero-hero-v1
       * - merge reference/referenceAlt
       */

      setResult(data);

      const blocks =
        Array.isArray(
          data?.detectedBlocks
        )
          ? data.detectedBlocks
          : [];

      if (blocks.length > 0) {
        setActiveBlock(
          blocks[0]
        );

        setActiveView('json');
      }
    } catch (err) {
      console.error(
        'Conversion error:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while converting the document.'
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     GET CURRENT XWALK DATA
  ========================= */

  function getCurrentXwalk() {
    return {
      definitions:
        Array.isArray(
          result?.xwalk?.definitions
        )
          ? result.xwalk.definitions
          : [],

      models:
        Array.isArray(
          result?.xwalk?.models
        )
          ? result.xwalk.models
          : [],

      filters:
        Array.isArray(
          result?.xwalk?.filters
        )
          ? result.xwalk.filters
          : [],
    };
  }

  /* =========================
     FIND DEFINITION
  ========================= */

  function findDefinition(block) {
    if (!block) {
      return null;
    }

    const {
      definitions,
    } = getCurrentXwalk();

    let definition =
      definitions.find(
        (item) =>
          item?.id === block.id
      );

    if (definition) {
      return definition;
    }

    definition =
      definitions.find(
        (item) =>
          item?.title ===
          block.title
      );

    if (definition) {
      return definition;
    }

    definition =
      definitions.find(
        (item) =>
          item?.plugins?.xwalk?.page
            ?.template?.name ===
          block.title
      );

    if (definition) {
      return definition;
    }

    definition =
      definitions.find(
        (item) =>
          item?.plugins?.xwalk?.page
            ?.template?.model ===
          block.id
      );

    if (definition) {
      return definition;
    }

    return null;
  }

  /* =========================
     FIND MODEL
  ========================= */

  function findModel(block) {
    if (!block) {
      return null;
    }

    const {
      models,
    } = getCurrentXwalk();

    let model =
      models.find(
        (item) =>
          item?.id === block.id
      );

    if (model) {
      return model;
    }

    model =
      models.find(
        (item) =>
          item?.title ===
          block.title
      );

    if (model) {
      return model;
    }

    return null;
  }

  /* =========================
     XWALK JSON
  ========================= */

  function getJson() {
    if (!activeBlock) {
      return '{}';
    }

    const {
      filters,
    } = getCurrentXwalk();

    const definition =
      findDefinition(
        activeBlock
      );

    const model =
      findModel(
        activeBlock
      );

    const json = {
      definitions:
        definition
          ? [definition]
          : [],

      models:
        model
          ? [model]
          : [],

      filters,
    };

    return formatJson(json);
  }

  /* =========================
     HTML
  ========================= */

  function getHtml() {
    if (!activeBlock) {
      return '';
    }

    return formatHtml(
      activeBlock.html || ''
    );
  }

  /* =========================
     CURRENT CODE
  ========================= */

  const currentCode =
    useMemo(() => {
      if (
        activeView === 'html'
      ) {
        return getHtml();
      }

      return getJson();
    }, [
      activeBlock,
      activeView,
      result,
    ]);

  /* =========================
     COPY
  ========================= */

  async function copyText(text) {
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setError(
        'Unable to copy content.'
      );
    }
  }

  /* =========================
     DOWNLOAD JSON
  ========================= */

  function downloadBlockJson(block) {
    if (!block) {
      return;
    }

    const {
      filters,
    } = getCurrentXwalk();

    const definition =
      findDefinition(block);

    const model =
      findModel(block);

    const json = {
      definitions:
        definition
          ? [definition]
          : [],

      models:
        model
          ? [model]
          : [],

      filters,
    };

    downloadFile(
      formatJson(json),
      `${block.id}.json`,
      'application/json'
    );
  }

  /* =========================
     DOWNLOAD HTML
  ========================= */

  function downloadBlockHtml(
    block
  ) {
    if (!block) {
      return;
    }

    downloadFile(
      formatHtml(
        block.html || ''
      ),
      `${block.id}.html`,
      'text/html'
    );
  }

  /* =========================
     LINE NUMBERS
  ========================= */

  function renderCode() {
    if (!currentCode) {
      return null;
    }

    const lines =
      currentCode.split('\n');

    return lines.map(
      (line, index) => (
        <div
          className="code-line"
          key={index}
        >
          <span className="line-number">
            {index + 1}
          </span>

          <span
            className={
              activeView === 'json'
                ? 'line-content json-code'
                : 'line-content html-code'
            }
          >
            {line || ' '}
          </span>
        </div>
      )
    );
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="app dark">

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            E
          </div>

          <div>
            <h1>
              EDS Block Converter
            </h1>

            <p>
              DOCX → EDS HTML + XWalk
            </p>
          </div>

        </div>

      </header>

      <main className="workspace">

        <aside className="sidebar">

          <div className="upload-box">

            <div className="upload-icon">
              ↑
            </div>

            <h2>
              Upload Document
            </h2>

            <p>
              Select a DOCX file to
              generate EDS blocks.
            </p>

            <label className="upload-button">

              <span>
                Choose DOCX
              </span>

              <input
                type="file"
                accept=".docx"
                onChange={
                  handleFileChange
                }
              />

            </label>

            {file && (
              <div className="file-name">

                <span className="file-icon">
                  DOCX
                </span>

                <span className="file-text">
                  {file.name}
                </span>

              </div>
            )}

            <button
              className="convert-button"
              disabled={
                !file || loading
              }
              onClick={
                handleConvert
              }
            >
              {loading
                ? 'Converting...'
                : 'Convert Document'}
            </button>

            {error && (
              <div className="error">
                {error}
              </div>
            )}

          </div>

          {result && (
            <div className="block-list">

              <div className="section-title">

                <span>
                  Detected Blocks
                </span>

                <span className="count">
                  {result.detectedBlocks
                    ?.length || 0}
                </span>

              </div>

              <div className="blocks-wrapper">

                {result.detectedBlocks?.map(
                  (block, index) => (
                    <button
                      key={`${block.id}-${index}`}
                      className={
                        activeBlock === block
                          ? 'block-item active'
                          : 'block-item'
                      }
                      onClick={() => {
                        setActiveBlock(
                          block
                        );

                        setActiveView(
                          'json'
                        );

                        setCopied(
                          false
                        );
                      }}
                    >

                      <span className="block-symbol">
                        ▦
                      </span>

                      <span className="block-info">

                        <strong>
                          {block.title}
                        </strong>

                        <small>
                          {block.id}
                        </small>

                      </span>

                      <span className="block-arrow">
                        →
                      </span>

                    </button>
                  )
                )}

              </div>

            </div>
          )}

        </aside>

        <section className="content">

          {loading && (
            <div className="loading-screen">

              <div className="loader-card">

                <div className="loader-dots">

                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />

                </div>

                <h2>
                  Converting document
                </h2>

                <p>
                  {loadingText}
                </p>

                <div className="loading-line">
                  <span />
                </div>

                <small>
                  Generating your EDS blocks
                </small>

              </div>

            </div>
          )}

          {!result &&
            !loading && (
              <div className="empty-state">

                <div className="empty-icon">
                  <span>
                    E
                  </span>
                </div>

                <h2>
                  Start by uploading a DOCX
                </h2>

                <p>
                  Your detected blocks,
                  XWalk JSON and HTML
                  will appear here.
                </p>

              </div>
            )}

          {result &&
            activeBlock &&
            !loading && (
              <div className="result-view">

                <div className="content-header">

                  <div className="block-heading">

                    <div className="block-label">
                      BLOCK NAME
                    </div>

                    <h2>
                      {activeBlock.title}
                    </h2>

                    <span className="id-badge">
                      {activeBlock.id}
                    </span>

                  </div>

                  <div className="block-actions">

                    <button
                      onClick={() =>
                        downloadBlockJson(
                          activeBlock
                        )
                      }
                    >
                      <span>
                        ↓
                      </span>

                      JSON
                    </button>

                    <button
                      onClick={() =>
                        downloadBlockHtml(
                          activeBlock
                        )
                      }
                    >
                      <span>
                        ↓
                      </span>

                      HTML
                    </button>

                  </div>

                </div>

                <div className="tabs">

                  <button
                    className={
                      activeView ===
                      'json'
                        ? 'active'
                        : ''
                    }
                    onClick={() => {
                      setActiveView(
                        'json'
                      );

                      setCopied(
                        false
                      );
                    }}
                  >

                    <span className="tab-icon">
                      {'{}'}
                    </span>

                    JSON

                  </button>

                  <button
                    className={
                      activeView ===
                      'html'
                        ? 'active'
                        : ''
                    }
                    onClick={() => {
                      setActiveView(
                        'html'
                      );

                      setCopied(
                        false
                      );
                    }}
                  >

                    <span className="tab-icon">
                      {'</>'}
                    </span>

                    HTML

                  </button>

                </div>

                <div
                  className={
                    activeView ===
                    'json'
                      ? 'code-card json-editor'
                      : 'code-card html-editor'
                  }
                >

                  <div className="code-toolbar">

                    <div className="code-file-info">

                      <span className="window-dots">

                        <i />
                        <i />
                        <i />

                      </span>

                      <span className="file-type">
                        {activeView ===
                        'json'
                          ? 'JSON'
                          : 'HTML'}
                      </span>

                      <span className="file-name-code">

                        {activeView ===
                        'json'
                          ? `${activeBlock.id}.json`
                          : `${activeBlock.id}.html`}

                      </span>

                    </div>

                    <button
                      className="copy-button"
                      onClick={() =>
                        copyText(
                          currentCode
                        )
                      }
                    >
                      {copied
                        ? '✓ Copied'
                        : 'Copy'}
                    </button>

                  </div>

                  <div className="code-editor">

                    <pre className="code">
                      {renderCode()}
                    </pre>

                  </div>

                </div>

                <div className="fields-panel">

                  <div className="fields-header">

                    <div>

                      <h3>
                        Detected Fields
                      </h3>

                      <p>
                        Fields detected from
                        the selected block
                      </p>

                    </div>

                    <span className="field-count">
                      {activeBlock.fields
                        ?.length || 0}
                    </span>

                  </div>

                  <div className="fields-grid">

                    {activeBlock.fields?.map(
                      (
                        field,
                        index
                      ) => (
                        <div
                          className="field-card"
                          key={`${field.name}-${index}`}
                        >

                          <div className="field-top">

                            <strong>
                              {field.name}
                            </strong>

                            <span>
                              {field.component}
                            </span>

                          </div>

                          <small>
                            {field.label}
                          </small>

                        </div>
                      )
                    )}

                  </div>

                </div>

              </div>
            )}

        </section>

      </main>

    </div>
  );
}

export default App;