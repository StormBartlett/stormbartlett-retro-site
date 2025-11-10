"use client";

import { useMemo, useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Vimirror } from "./vim/Vimirror";

type TodoEditorProps = {
  initialText?: string;
};

export default function TodoEditor({ initialText = "" }: TodoEditorProps) {
  const content = useMemo(() => {
    if (!initialText) {
      return {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [
                  {
                    type: 'paragraph',
                    content: []
                  }
                ]
              }
            ]
          }
        ]
      };
    }
    
    // Convert plain text lines to task list items
    // Lines starting with "- [ ]" or "- [x]" become tasks
    // Other lines become regular paragraphs
    const lines = initialText.split(/\n/);
    const taskItems: any[] = [];
    const paragraphs: any[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Check for checkbox format: "- [ ]" or "- [x]" or "[ ]" or "[x]"
      const checkboxMatch = trimmed.match(/^[-*]?\s*\[([ xX])\]\s*(.*)$/);
      
      if (checkboxMatch) {
        const isChecked = checkboxMatch[1].toLowerCase() === 'x';
        const taskText = checkboxMatch[2].trim();
        
        // Create task item with paragraph content
        const paragraphContent = taskText ? [
          {
            type: 'text',
            text: taskText
          }
        ] : [];
        
        taskItems.push({
          type: 'taskItem',
          attrs: { checked: isChecked },
          content: [
            {
              type: 'paragraph',
              content: paragraphContent
            }
          ]
        });
      } else if (trimmed) {
        // Regular paragraph
        paragraphs.push({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: trimmed
            }
          ]
        });
      }
    }
    
    const content: any[] = [];
    
    // If we have task items, add them as a task list
    if (taskItems.length > 0) {
      content.push({
        type: 'taskList',
        content: taskItems
      });
    }
    
    // Add regular paragraphs after task list
    if (paragraphs.length > 0) {
      content.push(...paragraphs);
    }
    
    // If no content, add empty task list
    if (content.length === 0) {
      content.push({
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [
              {
                type: 'paragraph',
                content: []
              }
            ]
          }
        ]
      });
    }
    
    return {
      type: 'doc',
      content
    };
  }, [initialText]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default bulletList to avoid conflicts
        bulletList: false,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'task-item',
        },
        nested: true,
      }),
      Vimirror,
    ],
    content,
    editorProps: {
      attributes: {
        class: "ProseMirror",
      },
    },
    autofocus: true,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Sync data-checked attribute with checkbox state
      const view = editor.view;
      const taskItems = view.dom.querySelectorAll('li[data-type="taskItem"]');
      taskItems.forEach((item) => {
        const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox) {
          item.setAttribute('data-checked', checkbox.checked ? 'true' : 'false');
        }
      });
    },
  });

  // Sync data-checked on mount and updates
  useEffect(() => {
    if (!editor) return;
    
    const syncChecked = () => {
      const view = editor.view;
      const taskItems = view.dom.querySelectorAll('li[data-type="taskItem"]');
      taskItems.forEach((item) => {
        const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (checkbox) {
          const isChecked = checkbox.checked;
          item.setAttribute('data-checked', isChecked ? 'true' : 'false');
          // Also apply strikethrough directly via class
          const paragraph = item.querySelector('p');
          if (paragraph) {
            if (isChecked) {
              paragraph.style.textDecoration = 'line-through';
              paragraph.style.opacity = '0.6';
            } else {
              paragraph.style.textDecoration = '';
              paragraph.style.opacity = '';
            }
          }
        }
      });
    };

    // Initial sync
    const initialTimeout = setTimeout(syncChecked, 100);

    // Listen for checkbox changes with multiple event types
    const handleCheckboxEvent = (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target && target.type === 'checkbox') {
        const taskItem = target.closest('li[data-type="taskItem"]') as HTMLElement;
        if (taskItem) {
          const isChecked = target.checked;
          taskItem.setAttribute('data-checked', isChecked ? 'true' : 'false');
          const paragraph = taskItem.querySelector('p') as HTMLElement;
          if (paragraph) {
            if (isChecked) {
              paragraph.style.textDecoration = 'line-through';
              paragraph.style.opacity = '0.6';
            } else {
              paragraph.style.textDecoration = '';
              paragraph.style.opacity = '';
            }
          }
        }
      }
    };

    const editorElement = editor.view.dom;
    
    // Listen to multiple events
    editorElement.addEventListener('change', handleCheckboxEvent, true);
    editorElement.addEventListener('click', handleCheckboxEvent, true);
    
    // Use MutationObserver to catch DOM changes
    const observer = new MutationObserver(() => {
      syncChecked();
    });
    
    observer.observe(editorElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-checked']
    });
    
    return () => {
      clearTimeout(initialTimeout);
      editorElement.removeEventListener('change', handleCheckboxEvent, true);
      editorElement.removeEventListener('click', handleCheckboxEvent, true);
      observer.disconnect();
    };
  }, [editor]);

  return (
    <div className="pm-editor todo-editor">
      <EditorContent editor={editor} />
    </div>
  );
}

