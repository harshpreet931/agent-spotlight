import React from 'react';
import { FileText, Globe, Folder, Calculator, File, Wrench } from 'lucide-react';
import { ResultItem } from './spotlight';

// A simple function to get a file icon
const getFileIcon = (path: string) => {
  if (path.endsWith('.app')) return <Globe className="w-8 h-8 text-blue-500" />;
  if (path.endsWith('.txt')) return <FileText className="w-8 h-8 text-gray-500" />;
  return <File className="w-8 h-8 text-gray-400" />;
};

const ResultItemComponent = ({ item, index }: { item: ResultItem; index: number }) => {
  switch (item.type) {
    case 'text':
      return (
        <div key={index} className="px-6 py-3 text-gray-700 text-base">
          {item.content}
        </div>
      );
    case 'tool-list':
      return (
        <div key={index} className="px-6 py-3 text-gray-700 text-base">
          <h3 className="font-semibold mb-2">Tools Available:</h3>
          <ul>
            {item.content.map((tool, i) => (
              <li key={i} className="flex items-start mb-2">
                <Wrench className="w-5 h-5 text-gray-500 mr-3 mt-1" />
                <div>
                  <p className="font-medium text-gray-800">{tool.name}</p>
                  <p className="text-sm text-gray-500">{tool.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'file':
      const { path, is_dir } = item.content;
      const fileName = path.split('/').pop();
      return (
        <div key={index} className="flex items-center px-6 py-3 hover:bg-gray-100 rounded-lg transition-colors duration-150 cursor-pointer">
          <div className="mr-4">
            {is_dir ? <Folder className="w-8 h-8 text-yellow-500" /> : getFileIcon(path)}
          </div>
          <div className="flex-grow">
            <p className="font-medium text-gray-800">{fileName}</p>
            <p className="text-sm text-gray-500">{path}</p>
          </div>
        </div>
      );
    case 'math':
      return (
        <div key={index} className="flex items-center px-6 py-3">
          <div className="mr-4">
            <Calculator className="w-8 h-8 text-green-500" />
          </div>
          <div className="flex-grow">
            <p className="font-medium text-gray-800 text-lg">{item.content}</p>
            <p className="text-sm text-gray-500">Result</p>
          </div>
        </div>
      );
    default:
      return null;
  }
};

export default React.memo(ResultItemComponent);
