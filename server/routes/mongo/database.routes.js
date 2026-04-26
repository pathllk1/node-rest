/**
 * ════════════════════════════════════════════════════════════════════════════════
 * SUPER ADMIN DATABASE ROUTES
 * All routes require super_admin role and CSRF protection
 * ════════════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import {
  getCollections,
  getCollectionData,
  getCollectionStats,
  exportCollectionAsJSON,
  deleteDocument,
  getSampleDocuments,
  getBackupStatus,
  backupDatabaseToWebDav,
  emptyCollection,
  dropCollection,
} from '../../controllers/mongo/database.controller.js';
import { authMiddleware } from '../../middleware/mongo/authMiddleware.js';

const router = express.Router();

// All database routes require authentication
router.use(authMiddleware);

/**
 * GET /api/admin/database/collections
 * Get list of all MongoDB collections
 */
router.get('/collections', getCollections);

/**
 * GET /api/admin/database/backup/status
 * Returns whether Infini-Cloud WebDAV backup is configured
 */
router.get('/backup/status', getBackupStatus);

/**
 * POST /api/admin/database/backup
 * Creates a complete MongoDB backup and uploads it to Infini-Cloud WebDAV
 */
router.post('/backup', backupDatabaseToWebDav);

/**
 * GET /api/admin/database/:collection
 * Get data from specific collection with filtering, sorting, pagination
 * Query params: filter, search, limit, skip, sort, order
 */
router.get('/:collection', getCollectionData);

/**
 * GET /api/admin/database/:collection/stats
 * Get detailed stats about a collection
 */
router.get('/:collection/stats', getCollectionStats);

/**
 * GET /api/admin/database/:collection/samples
 * Get sample documents from a collection (useful for schema inspection)
 */
router.get('/:collection/samples', getSampleDocuments);

/**
 * GET /api/admin/database/:collection/export
 * Export all collection data as JSON file
 */
router.get('/:collection/export', exportCollectionAsJSON);

/**
 * DELETE /api/admin/database/:collection/empty
 * Delete ALL documents in a collection but keep the collection itself.
 * IMPORTANT: must be registered BEFORE /:collection/:id so Express doesn't
 * interpret the literal "empty" / "drop" path segments as an ObjectId param.
 */
router.delete('/:collection/empty', emptyCollection);

/**
 * DELETE /api/admin/database/:collection/drop
 * Drop (destroy) the entire collection from MongoDB.
 */
router.delete('/:collection/drop', dropCollection);

/**
 * DELETE /api/admin/database/:collection/:id
 * Delete a document by ID (requires super_admin + CSRF)
 */
router.delete('/:collection/:id', deleteDocument);

export default router;