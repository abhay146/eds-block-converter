import { useMemo, useState } from 'react';
import './App.css';

/* =========================================================
   API CONFIG
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3002/api/convert'
    : 'https://eds-block-converter.onrender.com/api/convert');

/* =========================================================
   JSON FORMATTER
========================================================= */

const formatJson = (value) => {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch (error) {
    console.error(
      'JSON formatting error:',
      error
    );

    return '';
  }
};

/* =========================================================
   REMOVE OLD FILTER FROM DEFINITION
========================================================= */

const cleanDefinition = (definition) => {
  if (!definition) {
    return null;
  }

  const cleaned = {
    ...definition
  };

  if (
    cleaned.plugins &&
    cleaned.plugins.xwalk &&
    cleaned.plugins.xwalk.page &&
    cleaned.plugins.xwalk.page.template
  ) {
    cleaned.plugins = {
      ...cleaned.plugins,

      xwalk: {
        ...cleaned.plugins.xwalk,

        page: {
          ...cleaned.plugins.xwalk.page,

          template: {
            ...cleaned.plugins.xwalk.page.template
          }
        }
      }
    };

    /*
     * IMPORTANT:
     * filter should NOT be inside template.
     */
    delete cleaned.plugins.xwalk.page.template.filter;
  }

  return cleaned;
};

/* =========================================================
   APP
========================================================= */

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [
    selectedBlockIndex,
    setSelectedBlockIndex
  ] = useState(0);

  const [
    activeTab,
    setActiveTab
  ] = useState('json');

  const [
    copied,
    setCopied
  ] = useState(false);

  /* =======================================================
     BLOCK FILES
  ======================================================= */

  const blockFiles = useMemo(() => {
    if (
      !result ||
      !Array.isArray(result.blockFiles)
    ) {
      return [];
    }

    return result.blockFiles;
  }, [result]);

  /* =======================================================
     SELECTED BLOCK
  ======================================================= */

  const selectedBlock =
    blockFiles[
      selectedBlockIndex
    ] || null;

  /* =======================================================
     SELECTED BLOCK ID
  ======================================================= */

  const selectedBlockId =
    selectedBlock?.json?.id ||
    selectedBlock?.id ||
    selectedBlock?.name ||
    '';

  /* =======================================================
     SELECTED BLOCK TITLE
  ======================================================= */

  const selectedBlockTitle =
    selectedBlock?.json?.title ||
    selectedBlock?.title ||
    selectedBlock?.name ||
    selectedBlockId ||
    'Block';

  /* =======================================================
     COMPLETE XWALK
  ======================================================= */

  const completeXwalk =
    useMemo(() => {
      if (
        !result?.xwalk ||
        typeof result.xwalk !== 'object'
      ) {
        return {
          definitions: [],
          models: [],
          filters: []
        };
      }

      const definitions =
        Array.isArray(
          result.xwalk.definitions
        )
          ? result.xwalk.definitions
              .map(cleanDefinition)
              .filter(Boolean)
          : [];

      const models =
        Array.isArray(
          result.xwalk.models
        )
          ? result.xwalk.models
          : [];

      const filters =
        Array.isArray(
          result.xwalk.filters
        )
          ? result.xwalk.filters
          : [];

      return {
        definitions,
        models,
        filters
      };
    }, [result]);

  /* =======================================================
     SELECTED BLOCK XWALK JSON

     THIS IS THE IMPORTANT PART.

     Only selected block:
       definitions
       models
       filters
  ======================================================= */

  const selectedBlockXwalk =
    useMemo(() => {
      if (
        !result?.xwalk ||
        !selectedBlockId
      ) {
        return null;
      }

      const definitions =
        Array.isArray(
          result.xwalk.definitions
        )
          ? result.xwalk.definitions
          : [];

      const models =
        Array.isArray(
          result.xwalk.models
        )
          ? result.xwalk.models
          : [];

      const backendFilters =
        Array.isArray(
          result.xwalk.filters
        )
          ? result.xwalk.filters
          : [];

      /* -----------------------------------------------
         FIND SELECTED DEFINITION
      ------------------------------------------------ */

      const definition =
        definitions.find(
          (item) =>
            item?.id ===
            selectedBlockId
        );

      /* -----------------------------------------------
         FIND SELECTED MODEL
      ------------------------------------------------ */

      const model =
        models.find(
          (item) =>
            item?.id ===
            selectedBlockId
        );

      /* -----------------------------------------------
         FIND SELECTED FILTER
      ------------------------------------------------ */

      const existingFilter =
        backendFilters.find(
          (item) =>
            item?.id ===
            selectedBlockId
        );

      /*
       * If backend already has filter,
       * use it.
       *
       * Otherwise create it.
       */

      const selectedFilter =
        existingFilter || {
          id: selectedBlockId,
          components: [
            selectedBlockId
          ]
        };

      /*
       * Remove filter from definition
       */

      const cleanedDefinition =
        cleanDefinition(
          definition
        );

      return {
        definitions:
          cleanedDefinition
            ? [cleanedDefinition]
            : [],

        models:
          model
            ? [model]
            : [],

        filters: [
          selectedFilter
        ]
      };
    }, [
      result,
      selectedBlockId
    ]);

  /* =======================================================
     SELECTED BLOCK JSON

     The JSON displayed on screen is selectedBlockXwalk.

     This means:
       Hero -> Hero XWalk only
       Columns -> Columns XWalk only
  ======================================================= */

  const selectedBlockJson =
    selectedBlockXwalk || {
      definitions: [],
      models: [],
      filters: []
    };

  /* =======================================================
     HANDLE FILE CHANGE
  ======================================================= */

  const handleFileChange = (
    event
  ) => {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith('.docx')
    ) {
      setError(
        'Only DOCX files are supported.'
      );

      setFile(null);

      return;
    }

    setFile(selectedFile);

    setResult(null);

    setError('');

    setSelectedBlockIndex(0);

    setActiveTab('json');

    setCopied(false);
  };

  /* =======================================================
     HANDLE CONVERT
  ======================================================= */

  const handleConvert =
    async () => {
      if (!file) {
        setError(
          'Please select a DOCX file first.'
        );

        return;
      }

      setLoading(true);

      setError('');

      setResult(null);

      setCopied(false);

      try {
        const formData =
          new FormData();

        formData.append(
          'file',
          file
        );

        console.log(
          '================================'
        );

        console.log(
          'EDS BLOCK CONVERTER'
        );

        console.log(
          'API URL:',
          API_URL
        );

        console.log(
          'FILE:',
          file.name
        );

        console.log(
          '================================'
        );

        const response =
          await fetch(
            API_URL,
            {
              method: 'POST',
              body: formData,
              cache: 'no-store'
            }
          );

        const responseText =
          await response.text();

        console.log(
          'RAW BACKEND RESPONSE:'
        );

        console.log(
          responseText
        );

        let backendData;

        try {
          backendData =
            JSON.parse(
              responseText
            );
        } catch {
          throw new Error(
            responseText ||
              'Backend did not return valid JSON.'
          );
        }

        if (!response.ok) {
          throw new Error(
            backendData?.error ||
              backendData?.message ||
              `Request failed with status ${response.status}`
          );
        }

        console.log(
          'PARSED BACKEND DATA:',
          backendData
        );

        console.log(
          'XWALK:',
          backendData?.xwalk
        );

        console.log(
          'BLOCK FILES:',
          backendData?.blockFiles
        );

        setResult(
          backendData
        );

        setSelectedBlockIndex(0);

        setActiveTab('json');

      } catch (err) {
        console.error(
          'Conversion error:',
          err
        );

        setError(
          err?.message ||
            'Something went wrong while converting the document.'
        );
      } finally {
        setLoading(false);
      }
    };

  /* =======================================================
     RESET
  ======================================================= */

  const handleReset = () => {
    setFile(null);

    setResult(null);

    setError('');

    setSelectedBlockIndex(0);

    setActiveTab('json');

    setCopied(false);
  };

  /* =======================================================
     SELECT BLOCK
  ======================================================= */

  const selectBlock = (
    index
  ) => {
    setSelectedBlockIndex(
      index
    );

    setActiveTab('json');

    setCopied(false);
  };

  /* =======================================================
     TAB CHANGE
  ======================================================= */

  const handleTabChange =
    (tab) => {
      setActiveTab(tab);

      setCopied(false);
    };

  /* =======================================================
     DOWNLOAD FILE
  ======================================================= */

  const downloadFile = (
    content,
    filename,
    type
  ) => {
    if (
      content === undefined ||
      content === null
    ) {
      return;
    }

    const finalContent =
      typeof content ===
      'string'
        ? content
        : JSON.stringify(
            content,
            null,
            2
          );

    const blob =
      new Blob(
        [finalContent],
        {
          type
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        'a'
      );

    link.href = url;

    link.download =
      filename;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(
      url
    );
  };

  /* =======================================================
     COPY CONTENT
  ======================================================= */

  const copyContent =
    async () => {
      let content = '';

      /* -----------------------------------------------
         JSON
      ------------------------------------------------ */

      if (
        activeTab ===
        'json'
      ) {
        content =
          formatJson(
            selectedBlockJson
          );
      }

      /* -----------------------------------------------
         HTML
      ------------------------------------------------ */

      else {
        content =
          selectedBlock?.html ||
          '';
      }

      if (!content) {
        return;
      }

      try {
        await navigator.clipboard.writeText(
          content
        );

        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 2000);

      } catch (err) {
        console.error(
          'Copy failed:',
          err
        );

        setError(
          'Unable to copy content.'
        );
      }
    };

  /* =======================================================
     JSON CONTENT
  ======================================================= */

  const jsonContent =
    formatJson(
      selectedBlockJson
    );

  /* =======================================================
     HTML CONTENT
  ======================================================= */

  const htmlContent =
    selectedBlock?.html ||
    '';

  /* =======================================================
     FILE NAMES
  ======================================================= */

  const jsonFileName =
    `${selectedBlockId || 'block'}.json`;

  const htmlFileName =
    selectedBlock?.htmlFile ||
    `${selectedBlockId || 'block'}.html`;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="top-header">

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

      {/* =================================================
          WORKSPACE
      ================================================= */}

      <div className="workspace">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside className="sidebar">

          {/* ===============================================
              UPLOAD CARD
          =============================================== */}

          <div className="upload-card">

            <div className="upload-icon">
              ↑
            </div>

            <h2>
              Upload Document
            </h2>

            <p>
              Select a DOCX file to generate EDS blocks.
            </p>

            <label className="choose-button">

              Choose DOCX

              <input
                type="file"
                accept=".docx"
                onChange={
                  handleFileChange
                }
              />

            </label>

            {/* FILE */}

            {file && (

              <div className="file-info">

                <div className="docx-icon">
                  DOCX
                </div>

                <span>
                  {file.name}
                </span>

              </div>

            )}

            {/* CONVERT */}

            <button
              type="button"
              className="convert-button"
              onClick={
                handleConvert
              }
              disabled={
                !file ||
                loading
              }
            >

              {loading
                ? 'Converting...'
                : 'Convert Document'}

            </button>

            {/* RESET */}

            {result && (

              <button
                type="button"
                className="reset-button"
                onClick={
                  handleReset
                }
              >
                Reset
              </button>

            )}

            {/* ERROR */}

            {error && (

              <div className="error-box">
                {error}
              </div>

            )}

          </div>

          {/* =================================================
              DETECTED BLOCKS
          ================================================= */}

          {blockFiles.length >
            0 && (

            <div className="blocks-section">

              <div className="blocks-heading">

                <span>
                  DETECTED BLOCKS
                </span>

                <span className="block-count">
                  {blockFiles.length}
                </span>

              </div>

              <div className="blocks-list">

                {blockFiles.map(
                  (
                    block,
                    index
                  ) => {

                    const blockTitle =
                      block?.json?.title ||
                      block?.title ||
                      block?.name ||
                      `Block ${index + 1}`;

                    const blockId =
                      block?.json?.id ||
                      block?.id ||
                      block?.name ||
                      'block';

                    return (

                      <button
                        type="button"
                        key={`${blockId}-${index}`}
                        className={`block-item ${
                          selectedBlockIndex ===
                          index
                            ? 'active'
                            : ''
                        }`}
                        onClick={() =>
                          selectBlock(
                            index
                          )
                        }
                      >

                        <div className="block-item-icon">
                          ▦
                        </div>

                        <div className="block-item-content">

                          <strong>
                            {blockTitle}
                          </strong>

                          <span>
                            {blockId}
                          </span>

                        </div>

                        <div className="arrow">
                          →
                        </div>

                      </button>

                    );
                  }
                )}

              </div>

            </div>

          )}

        </aside>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="content">

          {/* ===============================================
              LOADING
          =============================================== */}

          {loading && (

            <div className="loading-state">

              <div className="loader" />

              <p>
                Converting your document...
              </p>

            </div>

          )}

          {/* ===============================================
              EMPTY STATE
          =============================================== */}

          {!loading &&
            !result && (

            <div className="empty-state">

              <div className="empty-icon">
                E
              </div>

              <h2>
                Upload a DOCX document
              </h2>

              <p>
                Converted blocks will appear here.
              </p>

            </div>

          )}

          {/* ===============================================
              RESULT
          =============================================== */}

          {!loading &&
            result &&
            selectedBlock && (

            <>

              {/* =========================================
                  CONTENT HEADER
              ========================================= */}

              <div className="content-header">

                <div>

                  <p className="content-label">
                    BLOCK NAME
                  </p>

                  <h2>
                    {selectedBlockTitle}
                  </h2>

                  <span className="block-id">
                    {selectedBlockId}
                  </span>

                </div>

                <div className="download-actions">

                  {/* =====================================
                      SELECTED BLOCK JSON
                  ===================================== */}

                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        selectedBlockJson,
                        jsonFileName,
                        'application/json'
                      )
                    }
                  >
                    ⇩ JSON
                  </button>

                  {/* =====================================
                      SELECTED BLOCK HTML
                  ===================================== */}

                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        htmlContent,
                        htmlFileName,
                        'text/html'
                      )
                    }
                  >
                    ⇩ HTML
                  </button>

                  {/* =====================================
                      COMPLETE XWALK
                  ===================================== */}

                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        completeXwalk,
                        'xwalk.json',
                        'application/json'
                      )
                    }
                  >
                    ⇩ XWalk
                  </button>

                </div>

              </div>

              {/* =========================================
                  TABS
              ========================================= */}

              <div className="tabs">

                <button
                  type="button"
                  className={
                    activeTab ===
                    'json'
                      ? 'tab active-tab'
                      : 'tab'
                  }
                  onClick={() =>
                    handleTabChange(
                      'json'
                    )
                  }
                >
                  {'{}'} JSON
                </button>

                <button
                  type="button"
                  className={
                    activeTab ===
                    'html'
                      ? 'tab active-tab'
                      : 'tab'
                  }
                  onClick={() =>
                    handleTabChange(
                      'html'
                    )
                  }
                >
                  {'</>'} HTML
                </button>

              </div>

              {/* =========================================
                  CODE WINDOW
              ========================================= */}

              <div className="code-window">

                {/* HEADER */}

                <div className="code-window-header">

                  <div className="code-file-info">

                    <div className="window-dots">

                      <span />
                      <span />
                      <span />

                    </div>

                    <span className="code-type">

                      {activeTab ===
                      'json'
                        ? 'JSON'
                        : 'HTML'}

                    </span>

                    <span className="code-filename">

                      {activeTab ===
                      'json'
                        ? jsonFileName
                        : htmlFileName}

                    </span>

                  </div>

                  <button
                    type="button"
                    className={`copy-button ${
                      copied
                        ? 'copied'
                        : ''
                    }`}
                    onClick={
                      copyContent
                    }
                  >

                    {copied
                      ? '✓ Copied'
                      : 'Copy'}

                  </button>

                </div>

                {/* CODE */}

                <div className="code-content">

                  <pre>
                    <code>
                      {activeTab ===
                      'json'
                        ? jsonContent
                        : htmlContent}
                    </code>
                  </pre>

                </div>

              </div>

            </>

          )}

          {/* ===============================================
              RESULT BUT NO BLOCK
          =============================================== */}

          {!loading &&
            result &&
            !selectedBlock && (

            <div className="empty-state">

              <h2>
                No block data available
              </h2>

              <p>
                The backend returned a result but no blockFiles.
              </p>

            </div>

          )}

        </main>

      </div>

    </div>
  );
}

export default App;