import * as vscode from 'vscode';

/**
 * ANSI to HTML Converter
 * Converts text with ANSI escape codes to HTML
 */
export class AnsiToHtml {
  private options: any;
  
  constructor(options: any = {}) {
    this.options = {
      fg: '#FFF',
      bg: '#000',
      newline: false,
      escapeXML: false,
      colors: this.getDefaultColors(),
      ...options
    };
  }

  getDefaultColors() {
    return {
      0: '#000',       // Black
      1: '#A00',       // Red
      2: '#0A0',       // Green
      3: '#A50',       // Yellow
      4: '#00A',       // Blue
      5: '#A0A',       // Magenta
      6: '#0AA',       // Cyan
      7: '#AAA',       // White
      8: '#555',       // Bright Black (Gray)
      9: '#F55',       // Bright Red
      10: '#5F5',      // Bright Green
      11: '#FF5',      // Bright Yellow
      12: '#55F',      // Bright Blue
      13: '#F5F',      // Bright Magenta
      14: '#5FF',      // Bright Cyan
      15: '#FFF'       // Bright White
    };
  }

  convert(text: string) {
    const { colors, fg, bg, newline, escapeXML } = this.options;
    let result = '';
    let openTags = [];
    let currentFg = fg;
    let currentBg = bg;
    let currentStyles: string[] = [];

    // Process each character
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\x1B') {
        // ANSI escape sequence
        const endIdx = text.indexOf('m', i);
        if (endIdx === -1) continue;

        const codeStr = text.substring(i + 2, endIdx);
        const codes = codeStr.split(';').filter(c => c !== '').map(Number);
        i = endIdx;

        // Close all previous tags
        result += this.closeTags(openTags);
        openTags = [];
        currentStyles = [];

        // Process each ANSI code
        for (let j = 0; j < codes.length; j++) {
          const code = codes[j];
          
          if (code === 0) {
            // Reset
            currentFg = fg;
            currentBg = bg;
            currentStyles = [];
          } else if (code === 1) {
            // Bold
            currentStyles.push('font-weight:bold');
          } else if (code === 3) {
            // Italic
            currentStyles.push('font-style:italic');
          } else if (code === 4) {
            // Underline
            currentStyles.push('text-decoration:underline');
          } else if (code === 7) {
            // Inverse
            [currentFg, currentBg] = [currentBg, currentFg];
          } else if (code === 22) {
            // Normal intensity
            currentStyles = currentStyles.filter(s => !s.includes('font-weight'));
          } else if (code === 23) {
            // Not italic
            currentStyles = currentStyles.filter(s => !s.includes('font-style'));
          } else if (code === 24) {
            // Not underline
            currentStyles = currentStyles.filter(s => !s.includes('text-decoration'));
          } else if (code === 27) {
            // Not inverse
            [currentFg, currentBg] = [currentBg, currentFg];
          } else if (code >= 30 && code <= 37) {
            // Foreground color
            currentFg = colors[code - 30];
          } else if (code === 39) {
            // Default foreground
            currentFg = fg;
          } else if (code >= 40 && code <= 47) {
            // Background color
            currentBg = colors[code - 40];
          } else if (code === 49) {
            // Default background
            currentBg = bg;
          } else if (code >= 90 && code <= 97) {
            // Bright foreground
            currentFg = colors[8 + (code - 90)];
          } else if (code >= 100 && code <= 107) {
            // Bright background
            currentBg = colors[8 + (code - 100)];
          }
        }

        // Build style string
        const style = [
          `color:${currentFg}`,
          `background-color:${currentBg}`,
          ...currentStyles
        ].join(';');

        if (style) {
          openTags.push('span');
          result += `<span style="${style}">`;
        }
      } else {
        // Regular character
        if (escapeXML) {
          result += this.escapeXml(text[i]);
        } else {
          result += text[i];
        }
      }
    }

    // Close any remaining tags
    result += this.closeTags(openTags);

    // Handle newlines
    if (newline) {
      result = result.replace(/\n/g, '<br>');
    }

    return result;
  }

  closeTags(openTags: string[]) {
    return openTags.reverse().map(tag => `</${tag}>`).join('');
  }

  escapeXml(text: string) {
    return text.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}

export function createThemeAwareAnsiConverter(): AnsiToHtml {
    const theme = vscode.window.activeColorTheme;
    const colors: any = vscode.workspace.getConfiguration('workbench').get('colorCustomizations');
    
    // Map VS Code theme colors to ANSI colors
    const ansiColors: any = {
        // Standard colors (dark theme typically uses these)
        0:  colors?.['terminal.ansiBlack']   ?? '#000000', // Black
        1:  colors?.['terminal.ansiRed']     ?? '#CD3131', // Red
        2:  colors?.['terminal.ansiGreen']   ?? '#0DBC79', // Green
        3:  colors?.['terminal.ansiYellow']  ?? '#E5E510', // Yellow
        4:  colors?.['terminal.ansiBlue']    ?? '#2472C8', // Blue
        5:  colors?.['terminal.ansiMagenta'] ?? '#BC3FBC', // Magenta
        6:  colors?.['terminal.ansiCyan']    ?? '#11A8CD', // Cyan
        7:  colors?.['terminal.ansiWhite']   ?? '#E5E5E5', // White
        
        // Bright colors
        8:  colors?.['terminal.ansiBrightBlack']   ?? '#666666', // Bright Black
        9:  colors?.['terminal.ansiBrightRed']     ?? '#F14C4C', // Bright Red
        10: colors?.['terminal.ansiBrightGreen']   ?? '#23D18B', // Bright Green
        11: colors?.['terminal.ansiBrightYellow']  ?? '#F5F543', // Bright Yellow
        12: colors?.['terminal.ansiBrightBlue']    ?? '#3B8EEA', // Bright Blue
        13: colors?.['terminal.ansiBrightMagenta'] ?? '#D670D6', // Bright Magenta
        14: colors?.['terminal.ansiBrightCyan']    ?? '#29B8DB', // Bright Cyan
        15: colors?.['terminal.ansiBrightWhite']   ?? '#FFFFFF'  // Bright White
    };

    return new AnsiToHtml({
        fg: theme.kind === vscode.ColorThemeKind.Dark 
            ? '#FFFFFF' 
            : '#000000',
        bg: theme.kind === vscode.ColorThemeKind.Dark 
            ? '#0000' 
            : '#0000',
        colors: ansiColors,
        newline: true,
        escapeXML: true
    });
}
