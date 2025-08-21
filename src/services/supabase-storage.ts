// Supabase Storage Service for Audio Files
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FileAttachment, UsageEvent } from '../types'
import { v4 as uuidv4 } from 'uuid'

export class SupabaseStorageService {
  constructor(private supabase: SupabaseClient) {}

  // General file upload method (for compatibility with existing code)
  async uploadFile(
    file: File | Blob,
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
    // For audio files, use specialized method
    if (options.contentType?.startsWith('audio/') || file.type?.startsWith('audio/')) {
      return this.uploadAudioFile(file, orgId, userId, options)
    }

    // For non-audio files, we can still use Supabase Storage but in a general bucket
    // For now, redirect to audio upload (since you want all files in Supabase)
    return this.uploadAudioFile(file, orgId, userId, options)
  }

  // Upload audio file to Supabase Storage
  async uploadAudioFile(
    file: File | Blob,
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
      // Generate unique file key for audio files
      const timestamp = Date.now()
      const uuid = uuidv4().split('-')[0]
      const extension = this.getFileExtension(options.filename || 'audio.webm')
      const fileKey = `${orgId}/${userId}/${timestamp}-${uuid}${extension}`

      // Validate file size (max 50MB for audio)
      const maxSize = 50 * 1024 * 1024 // 50MB
      if (file.size > maxSize) {
        return {
          success: false,
          error: 'Audio file size exceeds maximum limit of 50MB'
        }
      }

      // Upload to Supabase Storage audiobucket
      const { data, error } = await this.supabase.storage
        .from('audiobucket')
        .upload(fileKey, file, {
          contentType: options.contentType || file.type || 'audio/webm',
          metadata: {
            'org-id': orgId.toString(),
            'user-id': userId.toString(),
            'original-filename': options.filename || 'audio',
            'upload-timestamp': timestamp.toString(),
            ...(options.metadata || {})
          }
        })

      if (error) {
        console.error('Supabase Storage upload error:', error)
        return {
          success: false,
          error: `Upload failed: ${error.message}`
        }
      }

      // Get public URL for the uploaded file
      const { data: urlData } = this.supabase.storage
        .from('audiobucket')
        .getPublicUrl(fileKey)

      const publicUrl = urlData.publicUrl

      // Create file attachment object
      const attachment: FileAttachment = {
        name: options.filename || 'audio',
        type: options.contentType || file.type || 'audio/webm',
        size: file.size,
        url: publicUrl,
        r2_key: fileKey // Keep same property name for compatibility
      }

      // Calculate usage for billing (audio files)
      const audioMinutes = this.estimateAudioDuration(file.size, options.contentType || file.type)
      const usageEvent: Partial<UsageEvent> = {
        org_id: orgId,
        user_id: userId,
        event_type: 'audio',
        audio_minutes: audioMinutes,
        credits_charged: Math.ceil(audioMinutes / 2) // 2 minutes = 1 credit
      }

      return {
        success: true,
        file_key: fileKey,
        url: publicUrl,
        attachment,
        usage_event: usageEvent
      }
    } catch (error) {
      console.error('Error uploading audio file:', error)
      return {
        success: false,
        error: `Upload failed: ${error}`
      }
    }
  }

  // General file retrieval method (for compatibility)
  async getFile(fileKey: string, orgId?: number): Promise<{
    success: boolean
    data?: ArrayBuffer
    metadata?: Record<string, string>
    contentType?: string
    error?: string
  }> {
    const result = await this.getAudioFile(fileKey, orgId)
    if (!result.success) {
      return result
    }

    // Convert Blob to ArrayBuffer for compatibility
    const arrayBuffer = result.data ? await result.data.arrayBuffer() : undefined
    
    return {
      success: result.success,
      data: arrayBuffer,
      metadata: result.metadata,
      contentType: result.contentType,
      error: result.error
    }
  }

  // Get audio file from Supabase Storage
  async getAudioFile(fileKey: string, orgId?: number): Promise<{
    success: boolean
    data?: Blob
    metadata?: Record<string, any>
    contentType?: string
    error?: string
  }> {
    try {
      // Get file metadata first to check permissions
      const { data: fileData, error: fileError } = await this.supabase.storage
        .from('audiobucket')
        .info(fileKey)

      if (fileError || !fileData) {
        return {
          success: false,
          error: 'Audio file not found'
        }
      }

      // Check organization access if provided
      if (orgId && fileData.metadata?.['org-id'] !== orgId.toString()) {
        return {
          success: false,
          error: 'Access denied'
        }
      }

      // Download the file
      const { data: blob, error: downloadError } = await this.supabase.storage
        .from('audiobucket')
        .download(fileKey)

      if (downloadError || !blob) {
        return {
          success: false,
          error: `Failed to download audio file: ${downloadError?.message}`
        }
      }

      return {
        success: true,
        data: blob,
        metadata: fileData.metadata,
        contentType: fileData.metadata?.mimetype || 'audio/webm'
      }
    } catch (error) {
      console.error('Error getting audio file:', error)
      return {
        success: false,
        error: `Failed to get audio file: ${error}`
      }
    }
  }

  // Delete audio file from Supabase Storage
  async deleteAudioFile(fileKey: string, orgId?: number): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      // Verify ownership if orgId provided
      if (orgId) {
        const { data: fileData } = await this.supabase.storage
          .from('audiobucket')
          .info(fileKey)

        if (fileData && fileData.metadata?.['org-id'] !== orgId.toString()) {
          return {
            success: false,
            error: 'Access denied'
          }
        }
      }

      const { error } = await this.supabase.storage
        .from('audiobucket')
        .remove([fileKey])

      if (error) {
        return {
          success: false,
          error: `Failed to delete audio file: ${error.message}`
        }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting audio file:', error)
      return {
        success: false,
        error: `Failed to delete audio file: ${error}`
      }
    }
  }

  // List audio files for organization
  async listAudioFiles(
    orgId: number,
    userId?: number,
    options: {
      limit?: number
      offset?: number
    } = {}
  ): Promise<{
    success: boolean
    files?: Array<{
      name: string
      size: number
      lastModified: string
      metadata: Record<string, any>
      url: string
    }>
    error?: string
  }> {
    try {
      const prefix = userId ? `${orgId}/${userId}/` : `${orgId}/`

      const { data, error } = await this.supabase.storage
        .from('audiobucket')
        .list(prefix, {
          limit: options.limit || 100,
          offset: options.offset || 0,
          sortBy: { column: 'created_at', order: 'desc' }
        })

      if (error) {
        return {
          success: false,
          error: `Failed to list audio files: ${error.message}`
        }
      }

      const files = data.map(file => {
        const fullPath = `${prefix}${file.name}`
        const { data: urlData } = this.supabase.storage
          .from('audiobucket')
          .getPublicUrl(fullPath)

        return {
          name: file.name,
          size: file.metadata?.size || 0,
          lastModified: file.created_at || file.updated_at || '',
          metadata: file.metadata || {},
          url: urlData.publicUrl
        }
      })

      return {
        success: true,
        files
      }
    } catch (error) {
      console.error('Error listing audio files:', error)
      return {
        success: false,
        error: `Failed to list audio files: ${error}`
      }
    }
  }

  // Generate signed URL for temporary access (if needed for private files)
  async generateSignedUrl(
    fileKey: string,
    expirationSeconds: number = 3600
  ): Promise<{
    success: boolean
    url?: string
    error?: string
  }> {
    try {
      const { data, error } = await this.supabase.storage
        .from('audiobucket')
        .createSignedUrl(fileKey, expirationSeconds)

      if (error) {
        return {
          success: false,
          error: `Failed to generate signed URL: ${error.message}`
        }
      }

      return {
        success: true,
        url: data.signedUrl
      }
    } catch (error) {
      console.error('Error generating signed URL:', error)
      return {
        success: false,
        error: `Failed to generate signed URL: ${error}`
      }
    }
  }

  // Clean up old audio files
  async cleanupOldFiles(
    orgId: number,
    olderThanDays: number = 30
  ): Promise<{
    success: boolean
    deleted_count?: number
    error?: string
  }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

      const result = await this.listAudioFiles(orgId)
      
      if (!result.success || !result.files) {
        return {
          success: false,
          error: 'Failed to list files for cleanup'
        }
      }

      const oldFiles = result.files.filter(file => 
        new Date(file.lastModified) < cutoffDate
      )
      
      let deletedCount = 0
      const filesToDelete = oldFiles.map(file => 
        file.name.includes('/') ? file.name : `${orgId}/${file.name}`
      )

      if (filesToDelete.length > 0) {
        const { error } = await this.supabase.storage
          .from('audiobucket')
          .remove(filesToDelete)

        if (!error) {
          deletedCount = filesToDelete.length
        }
      }

      return {
        success: true,
        deleted_count: deletedCount
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error)
      return {
        success: false,
        error: `Cleanup failed: ${error}`
      }
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
      const result = await this.listAudioFiles(orgId)
      
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
        const extension = this.getFileExtension(file.name).toLowerCase()
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

  // Utility methods
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(lastDot) : ''
  }

  private estimateAudioDuration(fileSize: number, contentType: string): number {
    // Rough estimation based on file size and type
    // These are very rough estimates for billing purposes
    switch (contentType.toLowerCase()) {
      case 'audio/webm':
      case 'audio/ogg':
        // WebM/OGG: ~64kbps = 8KB/second
        return Math.ceil(fileSize / (8 * 1024))
      
      case 'audio/mp3':
      case 'audio/mpeg':
        // MP3: ~128kbps = 16KB/second
        return Math.ceil(fileSize / (16 * 1024))
      
      case 'audio/wav':
        // WAV: ~1.4Mbps = 176KB/second (uncompressed)
        return Math.ceil(fileSize / (176 * 1024))
      
      case 'audio/m4a':
      case 'audio/mp4':
        // M4A/MP4: ~128kbps = 16KB/second
        return Math.ceil(fileSize / (16 * 1024))
      
      default:
        // Conservative estimate for unknown formats
        return Math.ceil(fileSize / (32 * 1024)) // Assume 32KB/second
    }
  }
}