import React from 'react';

export type ToolCategory = 'automacoes' | 'sistema';

export interface NavigationItem {
  id: string;
  name: string;
  shortName?: string;
  fullName?: string;
  description: string;
  category: ToolCategory;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'muted';
  isReady: boolean;
  icon: React.ReactNode;
}

export interface SharedBreadcrumb {
  id: string | null;
  name: string;
}

export interface SharedFolder {
  id: string;
  name: string;
  parentId: string | null;
  userId: string;
  authorName: string;
  authorRole: 'admin' | 'gerente' | 'supervisor' | 'operador';
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
}

export interface SharedFile {
  id: string;
  folderId: string | null;
  name: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  userId: string;
  authorName: string;
  authorRole: 'admin' | 'gerente' | 'supervisor' | 'operador';
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
}

export interface FolderStats {
  folderCount: number;
  fileCount: number;
  totalBytes: number;
}
