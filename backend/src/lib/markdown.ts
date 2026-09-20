export function sanitizeImportedText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/<script/gi, '&lt;script')
    .replace(/<iframe/gi, '&lt;iframe');
}

function getInlineNodes(rawText: string) {
  const text = sanitizeImportedText(rawText);
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|__.*?__|_.*?_)/g).filter(Boolean);

  return tokens.map((token) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return { type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] };
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return { type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] };
    }
    if (token.startsWith('__') && token.endsWith('__')) {
      return { type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] };
    }
    if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      return { type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] };
    }
    return { type: 'text', text: token };
  });
}

export function markdownToProseMirror(markdown: string) {
  const safe = sanitizeImportedText(markdown).replace(/\r\n/g, '\n');
  const lines = safe.split('\n');
  const content: any[] = [];
  let listItems: any[] = [];
  let isOrderedList = false;

  const flushList = () => {
    if (listItems.length === 0) return;
    content.push({
      type: 'bulletList',
      content: listItems.map((item) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: item.content }],
      })),
    });
    listItems = [];
    isOrderedList = false;
  };

  const flushOrderedList = () => {
    if (listItems.length === 0) return;
    content.push({
      type: 'orderedList',
      content: listItems.map((item) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: item.content }],
      })),
    });
    listItems = [];
    isOrderedList = false;
  };

  const pushTextBlock = (text: string, level = 1) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (level >= 1 && level <= 6) {
      content.push({
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text: trimmed }],
      });
      return;
    }
    content.push({
      type: 'paragraph',
      content: getInlineNodes(trimmed),
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushOrderedList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      flushOrderedList();
      pushTextBlock(headingMatch[2], headingMatch[1].length);
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushOrderedList();
      listItems.push({ content: getInlineNodes(bulletMatch[1]) });
      isOrderedList = false;
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushList();
      listItems.push({ content: getInlineNodes(orderedMatch[1]) });
      isOrderedList = true;
      continue;
    }

    if (listItems.length > 0) {
      if (isOrderedList) flushOrderedList();
      else flushList();
    }

    pushTextBlock(line, 0);
  }

  if (listItems.length > 0) {
    if (isOrderedList) flushOrderedList();
    else flushList();
  }

  if (content.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  return { type: 'doc', content };
}
