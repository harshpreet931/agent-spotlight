import React from 'react';
import { FileText, Globe, File } from 'lucide-react';

// A simple function to get a file icon
export const getFileIcon = (path: string) => {
  if (path.endsWith('.app')) return <Globe className="w-8 h-8 text-blue-500" />;
  if (path.endsWith('.txt')) return <FileText className="w-8 h-8 text-gray-500" />;
  return <File className="w-8 h-8 text-gray-400" />;
};
