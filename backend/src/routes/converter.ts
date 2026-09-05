import type {
  FastifyInstance,
} from 'fastify';

import mammoth from 'mammoth';

import {
  convertToEdsHtml,
} from '../services/converter.js';

export async function converterRoutes(
  app: FastifyInstance,
) {
  app.post(
    '/convert',
    async (
      request,
      reply,
    ) => {
      try {
        /* =================================================
           GET FILE
        ================================================= */

        const file =
          await request.file();

        if (!file) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                'No DOCX file uploaded',
            });
        }

        /* =================================================
           VALIDATE DOCX
        ================================================= */

        if (
          !file.filename
            .toLowerCase()
            .endsWith('.docx')
        ) {
          return reply
            .code(400)
            .send({
              success: false,
              error:
                'Only DOCX files are supported',
            });
        }

        /* =================================================
           READ FILE
        ================================================= */

        const buffer =
          await file.toBuffer();

        /* =================================================
           DOCX -> HTML
        ================================================= */

        const mammothResult =
          await mammoth.convertToHtml({
            buffer,
          });

        /* =================================================
           HTML -> EDS + XWALK
        ================================================= */

        const result =
          convertToEdsHtml(
            mammothResult.value,
          );

        /* =================================================
           VALIDATE RESULT
        ================================================= */

        if (
          !result.html ||
          !result.html.trim()
        ) {
          return reply
            .code(500)
            .send({
              success: false,
              error:
                'Conversion returned empty HTML',
            });
        }

        /* =================================================
           FINAL RESPONSE
        ================================================= */

        return reply.send({
          success: true,

          filename:
            file.filename,

          /*
           * Converted EDS HTML
           */
          html:
            result.html,

          /*
           * Detected blocks
           */
          detectedBlocks:
            result.detectedBlocks,

          /*
           * Individual block files
           */
          blockFiles:
            result.blockFiles,

          /*
           * COMPLETE XWALK CONFIG
           *
           * THIS IS THE IMPORTANT PART.
           */
          xwalk: {
            definitions:
              result.xwalk
                .definitions,

            models:
              result.xwalk
                .models,

            filters:
              result.xwalk
                .filters,
          },

          messages:
            mammothResult.messages,
        });
      } catch (error) {
        app.log.error(error);

        return reply
          .code(500)
          .send({
            success: false,

            error:
              error instanceof Error
                ? error.message
                : 'Failed to convert DOCX file',
          });
      }
    },
  );
}