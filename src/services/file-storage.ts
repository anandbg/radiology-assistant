// File Storage Service for Cloudflare R2
import type { Bindings, FileAttachment, UsageEvent } from '../types'
import { v4 as uuidv4 } from 'uuid'

export class FileStorageService {
  constructor(private bucket: R2Bucket, private env: Bindings) {}

  // Upload file to R2 storage
  async uploadFile(
    file: File | ArrayBuffer,
    orgId: number,
    userId: number,
    options: {
      filename?: string
      contentType?: string
      metadata?: Record<string, string>
    } = {}
  ): Promise<{
    success: boolean
    file_key?: string
    url?: string
    attachment?: FileAttachment
    usage_event?: Partial<UsageEvent>
    error?: string
  }> {
    try {
      // Generate unique file key
      const timestamp = Date.now()
      const uuid = uuidv4().split('-')[0]
      const extension = this.getFileExtension(options.filename || 'file')
      const fileKey = `${orgId}/${userId}/${timestamp}-${uuid}${extension}`

      // Prepare file data
      let fileData: ArrayBuffer
      let fileSize: number
      let contentType: string

      if (file instanceof File) {
        fileData = await file.arrayBuffer()
        fileSize = file.size
        contentType = file.type || options.contentType || 'application/octet-stream'
      } else {
        fileData = file
        fileSize = file.byteLength
        contentType = options.contentType || 'application/octet-stream'
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (fileSize > maxSize) {
        return {
          success: false,
          error: 'File size exceeds maximum limit of 50MB'
        }
      }

      // Prepare metadata
      const metadata = {
        'org-id': orgId.toString(),
        'user-id': userId.toString(),
        'original-filename': options.filename || 'unknown',
        'upload-timestamp': timestamp.toString(),
        ...(options.metadata || {})
      }

      // Upload to R2
      await this.bucket.put(fileKey, fileData, {
        httpMetadata: {
          contentType,
          contentLength: fileSize
        },
        customMetadata: metadata
      })

      // Generate public URL (if bucket is configured for public access)
      const url = `https://${this.env.ENVIRONMENT === 'production' 
        ? 'files.radiologyassistant.com' 
        : 'localhost:3000'}/api/files/${fileKey}`

      // Create file attachment object
      const attachment: FileAttachment = {
        name: options.filename || 'unknown',
        type: contentType,
        size: fileSize,
        url,
        r2_key: fileKey
      }

      // Calculate usage for billing
      const pages = this.estimatePages(contentType, fileSize)
      const usageEvent: Partial<UsageEvent> = {
        org_id: orgId,
        user_id: userId,
        event_type: 'pages',
        pages,
        credits_charged: Math.ceil(pages / 2) // 2 pages = 1 credit
      }

      return {
        success: true,
        file_key: fileKey,
        url,
        attachment,
        usage_event
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      return {
        success: false,
        error: `Upload failed: ${error}`
      }
    }
  }

  // Get file from R2 storage
  async getFile(fileKey: string, orgId?: number): Promise<{
    success: boolean
    data?: ArrayBuffer
    metadata?: Record<string, string>
    contentType?: string
    error?: string
  }> {
    try {
      const object = await this.bucket.get(fileKey)

      if (!object) {
        return {
          success: false,
          error: 'File not found'
        }
      }

      // Check organization access if provided
      if (orgId && object.customMetadata?.['org-id'] !== orgId.toString()) {
        return {
          success: false,
          error: 'Access denied'
        }
      }

      const data = await object.arrayBuffer()

      return {
        success: true,
        data,
        metadata: object.customMetadata,
        contentType: object.httpMetadata?.contentType
      }
    } catch (error) {
      console.error('Error getting file:', error)
      return {
        success: false,
        error: `Failed to get file: ${error}`
      }
    }
  }

  // Delete file from R2 storage
  async deleteFile(fileKey: string, orgId?: number): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Verify ownership if orgId provided
      if (orgId) {
        const object = await this.bucket.get(fileKey)
        if (object && object.customMetadata?.['org-id'] !== orgId.toString()) {
          return {
            success: false,
            error: 'Access denied'
          }
        }
      }

      await this.bucket.delete(fileKey)

      return { success: true }
    } catch (error) {
      console.error('Error deleting file:', error)
      return {
        success: false,
        error: `Failed to delete file: ${error}`
      }
    }
  }

  // List files for organization
  async listFiles(
    orgId: number,
    userId?: number,
    options: {
      limit?: number
      cursor?: string
      prefix?: string
    } = {}
  ): Promise<{
    success: boolean
    files?: Array<{
      key: string
      size: number
      lastModified: Date
      metadata: Record<string, string>
    }>
    cursor?: string
    error?: string
  }> {
    try {
      const prefix = userId ? `${orgId}/${userId}/` : `${orgId}/`
      const fullPrefix = options.prefix ? `${prefix}${options.prefix}` : prefix

      const result = await this.bucket.list({
        prefix: fullPrefix,
        limit: options.limit || 100,
        cursor: options.cursor
      })

      const files = result.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        lastModified: obj.uploaded,
        metadata: obj.customMetadata || {}
      }))

      return {
        success: true,
        files,
        cursor: result.truncated ? result.cursor : undefined
      }
    } catch (error) {
      console.error('Error listing files:', error)
      return {
        success: false,
        error: `Failed to list files: ${error}`
      }
    }
  }

  // Process uploaded file for text extraction
  async processFile(
    fileKey: string,
    contentType: string
  ): Promise<{
    success: boolean
    text?: string
    pages?: number
    error?: string
  }> {
    try {
      const file = await this.getFile(fileKey)
      
      if (!file.success || !file.data) {
        return {
          success: false,
          error: 'Failed to retrieve file'
        }
      }

      let extractedText = ''
      let pageCount = 0

      switch (contentType.toLowerCase()) {
        case 'application/pdf':
          // PDF processing would require pdf-lib or similar
          // For now, return placeholder
          extractedText = '[PDF processing not implemented - use external service]'
          pageCount = this.estimatePages(contentType, file.data.byteLength)
          break

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          // DOCX processing would require mammoth or similar
          extractedText = '[DOCX processing not implemented - use external service]'
          pageCount = this.estimatePages(contentType, file.data.byteLength)
          break

        case 'text/plain':
          // Plain text
          const decoder = new TextDecoder()
          extractedText = decoder.decode(file.data)
          pageCount = Math.ceil(extractedText.length / 2500) // ~2500 chars per page
          break

        case 'image/jpeg':
        case 'image/png':
        case 'image/gif':
          // OCR would require Tesseract.js or external service
          extractedText = '[Image OCR not implemented - use external service]'
          pageCount = 1
          break

        default:
          return {
            success: false,
            error: `Unsupported file type: ${contentType}`
          }
      }

      return {
        success: true,
        text: extractedText,
        pages: pageCount
      }
    } catch (error) {
      console.error('Error processing file:', error)
      return {
        success: false,
        error: `File processing failed: ${error}`
      }
    }
  }

  // Generate signed URL for temporary access
  async generateSignedUrl(
    fileKey: string,
    expirationMinutes: number = 60
  ): Promise<{
    success: boolean
    url?: string
    error?: string
  }> {
    try {
      // Note: Cloudflare R2 signed URLs require additional setup
      // This is a placeholder implementation
      const baseUrl = `https://${this.env.APP_URL}/api/files`
      const expiry = Date.now() + (expirationMinutes * 60 * 1000)
      
      // In production, implement proper signed URL generation
      const signedUrl = `${baseUrl}/${fileKey}?expires=${expiry}`

      return {
        success: true,
        url: signedUrl
      }
    } catch (error) {
      console.error('Error generating signed URL:', error)
      return {
        success: false,
        error: `Failed to generate signed URL: ${error}`
      }
    }
  }

  // Clean up old files (for maintenance)
  async cleanupOldFiles(
    orgId: number,
    olderThanDays: number = 90
  ): Promise<{
    success: boolean
    deleted_count?: number
    error?: string
  }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      const result = await this.listFiles(orgId, undefined, { limit: 1000 })
      
      if (!result.success || !result.files) {
        return {
          success: false,
          error: 'Failed to list files for cleanup'
        }
      }

      const oldFiles = result.files.filter(file => file.lastModified < cutoffDate)
      let deletedCount = 0

      for (const file of oldFiles) {
        const deleteResult = await this.deleteFile(file.key, orgId)
        if (deleteResult.success) {
          deletedCount++
        }
      }

      return {
        success: true,
        deleted_count: deletedCount
      }
    } catch (error) {
      console.error('Error cleaning up files:', error)
      return {
        success: false,
        error: `Cleanup failed: ${error}`
      }
    }
  }

  // Utility methods
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(lastDot) : ''
  }

  private estimatePages(contentType: string, fileSize: number): number {
    switch (contentType.toLowerCase()) {
      case 'application/pdf':
        // Rough estimate: ~100KB per page for PDF
        return Math.ceil(fileSize / (100 * 1024))
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // Rough estimate: ~50KB per page for DOCX
        return Math.ceil(fileSize / (50 * 1024))
      
      case 'text/plain':
        // Estimate based on character count
        return Math.ceil(fileSize / 2500) // ~2500 chars per page
      
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
        // Images count as 1 page regardless of size
        return 1
      
      default:
        // Conservative estimate
        return Math.ceil(fileSize / (100 * 1024))
    }
  }

  // Get storage statistics
  async getStorageStats(orgId: number): Promise<{
    total_files: number
    total_size: number
    used_space_mb: number
    file_types: Record<string, number>
  }> {
    try {
      const result = await this.listFiles(orgId, undefined, { limit: 1000 })
      
      if (!result.success || !result.files) {
        return {
          total_files: 0,
          total_size: 0,
          used_space_mb: 0,
          file_types: {}
        }
      }

      const stats = {
        total_files: result.files.length,
        total_size: result.files.reduce((sum, file) => sum + file.size, 0),
        used_space_mb: 0,
        file_types: {} as Record<string, number>
      }

      stats.used_space_mb = Math.round(stats.total_size / (1024 * 1024) * 100) / 100

      // Count file types
      result.files.forEach(file => {
        const extension = this.getFileExtension(file.key).toLowerCase()
        stats.file_types[extension] = (stats.file_types[extension] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('Error getting storage stats:', error)
      return {
        total_files: 0,
        total_size: 0,
        used_space_mb: 0,
        file_types: {}
      }
    }
  }
}