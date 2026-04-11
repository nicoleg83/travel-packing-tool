const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, 'application/pdf'];

// POST /api/extract-file
// Accepts { filename, mimetype, content: base64 }
// Uses Claude vision (images) or document type (PDF) to extract itinerary text
router.post('/extract-file', async (req, res) => {
  const { filename, mimetype, content } = req.body;

  if (!content || !mimetype) {
    return res.status(400).json({ error: 'Missing file content or mimetype' });
  }

  if (!SUPPORTED_TYPES.includes(mimetype)) {
    return res.status(400).json({
      error: `Unsupported file type (${mimetype}). Please upload a PDF, JPEG, PNG, GIF, or WebP file.`,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const client = new Anthropic({ apiKey });

  try {
    const isImage = SUPPORTED_IMAGE_TYPES.includes(mimetype);

    const fileBlock = isImage
      ? { type: 'image', source: { type: 'base64', media_type: mimetype, data: content } }
      : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: content } };

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text: 'Extract all travel itinerary information from this file. Include dates, destinations, flights, hotels, activities, events, and any relevant schedule details. Return plain text only, organized chronologically. Be thorough — the output will be used to build a packing plan.',
          },
        ],
      }],
    });

    return res.json({ text: message.content[0].text });
  } catch (err) {
    console.error('File extraction error:', err.message);
    return res.status(500).json({ error: 'Failed to extract file content — please try again' });
  }
});

module.exports = router;
