import React from 'react';
import { render, screen } from '@testing-library/react';
import ToolCallInfo from '../ToolCallInfo';
import { UIResourceRenderer } from '@mcp-ui/client';
import UIResourceCarousel from '../UIResourceCarousel';

// Mock the dependencies
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: any) => {
    const translations: Record<string, string> = {
      com_assistants_domain_info: `Used ${values?.[0]}`,
      com_assistants_function_use: `Used ${values?.[0]}`,
      com_assistants_action_attempt: `Attempted to use ${values?.[0]}`,
      com_assistants_attempt_info: 'Attempted to use function',
      com_ui_result: 'Result',
      com_ui_ui_resources: 'UI Resources',
    };
    return translations[key] || key;
  },
}));

jest.mock('@mcp-ui/client', () => ({
  UIResourceRenderer: jest.fn(() => null),
}));

jest.mock('../UIResourceCarousel', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

// Add TextEncoder/TextDecoder polyfill for Jest environment
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

describe('ToolCallInfo', () => {
  const mockProps = {
    input: '{"test": "input"}',
    function_name: 'testFunction',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ui_resources extraction', () => {
    it('should extract single ui_resource from output', () => {
      const uiResource = {
        type: 'text',
        data: 'Test resource',
      };

      const output = JSON.stringify([
        { type: 'text', text: 'Regular output' },
        {
          metadata: 'ui_resources',
          text: 'W3sidHlwZSI6InRleHQiLCJkYXRhIjoiVGVzdCByZXNvdXJjZSJ9XQ==',
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      // Should render UIResourceRenderer for single resource
      expect(UIResourceRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: uiResource,
          onUIAction: expect.any(Function),
          htmlProps: {
            autoResizeIframe: { width: true, height: true },
          },
        }),
        expect.any(Object),
      );

      // Should not render carousel for single resource
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });

    it('should extract multiple ui_resources from output', () => {
      const uiResources = [
        { type: 'text', data: 'Resource 1' },
        { type: 'text', data: 'Resource 2' },
        { type: 'text', data: 'Resource 3' },
      ];

      const output = JSON.stringify([
        { type: 'text', text: 'Regular output' },
        {
          metadata: 'ui_resources',
          text: 'W3sidHlwZSI6InRleHQiLCJkYXRhIjoiUmVzb3VyY2UgMSJ9LHsidHlwZSI6InRleHQiLCJkYXRhIjoiUmVzb3VyY2UgMiJ9LHsidHlwZSI6InRleHQiLCJkYXRhIjoiUmVzb3VyY2UgMyJ9XQ==',
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      // Should render carousel for multiple resources
      expect(UIResourceCarousel).toHaveBeenCalledWith(
        expect.objectContaining({
          uiResources,
        }),
        expect.any(Object),
      );

      // Should not render individual UIResourceRenderer
      expect(UIResourceRenderer).not.toHaveBeenCalled();
    });

    it('should filter out ui_resources from displayed output', () => {
      const regularContent = [
        { type: 'text', text: 'Regular output 1' },
        { type: 'text', text: 'Regular output 2' },
      ];

      const output = JSON.stringify([
        ...regularContent,
        {
          metadata: 'ui_resources',
          text: 'W3sidHlwZSI6InRleHQiLCJkYXRhIjoiVUkgUmVzb3VyY2UifV0=',
        },
      ]);

      const { container } = render(<ToolCallInfo {...mockProps} output={output} />);

      // Check that the displayed output doesn't contain ui_resources
      const codeBlocks = container.querySelectorAll('code');
      const outputCode = codeBlocks[1]?.textContent; // Second code block is the output

      expect(outputCode).toContain('Regular output 1');
      expect(outputCode).toContain('Regular output 2');
      expect(outputCode).not.toContain('ui_resources');
    });

    it('should handle output without ui_resources', () => {
      const output = JSON.stringify([{ type: 'text', text: 'Regular output' }]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(UIResourceRenderer).not.toHaveBeenCalled();
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });

    it('should handle malformed ui_resources gracefully', () => {
      const output = JSON.stringify([
        {
          metadata: 'ui_resources',
          text: 'invalid-base64!@#', // Invalid base64 characters
        },
      ]);

      // Component should not throw error and should render without UI resources
      const { container } = render(<ToolCallInfo {...mockProps} output={output} />);

      // Should render the component without crashing
      expect(container).toBeTruthy();

      // UIResourceCarousel should not be called since the base64 is invalid
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });

    it('should handle ui_resources as plain text without breaking', () => {
      const outputWithTextOnly =
        'This output contains ui_resources as plain text but not as a proper structure';

      render(<ToolCallInfo {...mockProps} output={outputWithTextOnly} />);

      // Should render normally without errors
      expect(screen.getByText(`Used ${mockProps.function_name}`)).toBeInTheDocument();
      expect(screen.getByText('Result')).toBeInTheDocument();

      // The output text should be displayed in a code block
      const codeBlocks = screen.getAllByText((content, element) => {
        return element?.tagName === 'CODE' && content.includes(outputWithTextOnly);
      });
      expect(codeBlocks.length).toBeGreaterThan(0);

      // Should not render UI resources components
      expect(UIResourceRenderer).not.toHaveBeenCalled();
      expect(UIResourceCarousel).not.toHaveBeenCalled();
    });
  });

  describe('rendering logic', () => {
    it('should render UI Resources heading when ui_resources exist', () => {
      const output = JSON.stringify([
        {
          metadata: 'ui_resources',
          text: 'W3sidHlwZSI6InRleHQiLCJkYXRhIjoiVGVzdCJ9XQ==',
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(screen.getByText('UI Resources')).toBeInTheDocument();
    });

    it('should not render UI Resources heading when no ui_resources', () => {
      const output = JSON.stringify([{ type: 'text', text: 'Regular output' }]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(screen.queryByText('UI Resources')).not.toBeInTheDocument();
    });

    it('should pass correct props to UIResourceRenderer', () => {
      const uiResource = {
        type: 'form',
        data: { fields: [{ name: 'test', type: 'text' }] },
      };

      const output = JSON.stringify([
        {
          metadata: 'ui_resources',
          text: 'W3sidHlwZSI6ImZvcm0iLCJkYXRhIjp7ImZpZWxkcyI6W3sibmFtZSI6InRlc3QiLCJ0eXBlIjoidGV4dCJ9XX19XQ==',
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(UIResourceRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: uiResource,
          onUIAction: expect.any(Function),
          htmlProps: {
            autoResizeIframe: { width: true, height: true },
          },
        }),
        expect.any(Object),
      );
    });

    it('should console.log when UIAction is triggered', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const output = JSON.stringify([
        {
          metadata: 'ui_resources',
          text: 'W3sidHlwZSI6InRleHQiLCJkYXRhIjoiVGVzdCJ9XQ==',
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      const mockUIResourceRenderer = UIResourceRenderer as jest.MockedFunction<
        typeof UIResourceRenderer
      >;
      const onUIAction = mockUIResourceRenderer.mock.calls[0]?.[0]?.onUIAction;
      const testResult = { action: 'submit', data: { test: 'value' } };

      if (onUIAction) {
        await onUIAction(testResult as any);
      }

      expect(consoleSpy).toHaveBeenCalledWith('Action:', testResult);

      consoleSpy.mockRestore();
    });
  });

  describe('production base64 data tests', () => {
    it('should handle production base64 tool call response with a simple ui resource url-based', () => {
      const productionBase64 =
        'W3sidXJpIjoidWk6Ly9wcm9kdWN0L2dpZDovL3Nob3BpZnkvUHJvZHVjdC83MDkxNjIxNTI3NjMyIiwibWltZVR5cGUiOiJ0ZXh0L3VyaS1saXN0IiwidGV4dCI6Imh0dHBzOi8vbWNwc3RvcmVmcm9udC5jb20vaW1nL3N0b3JlZnJvbnQvcHJvZHVjdC5jb21wb25lbnQuaHRtbD9zdG9yZV9kb21haW49YWxsYmlyZHMuY29tJnByb2R1Y3RfaGFuZGxlPW1lbnMtdHJlZS1ydW5uZXJzLWJsaXp6YXJkLWJvbGQtcmVkJnByb2R1Y3RfaWQ9Z2lkOi8vc2hvcGlmeS9Qcm9kdWN0LzcwOTE2MjE1Mjc2MzImbW9kZT10b29sIn1d';

      const output = JSON.stringify([
        {
          metadata: 'ui_resources',
          text: productionBase64,
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(UIResourceRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: {
            mimeType: 'text/uri-list',
            text: 'https://mcpstorefront.com/img/storefront/product.component.html?store_domain=allbirds.com&product_handle=mens-tree-runners-blizzard-bold-red&product_id=gid://shopify/Product/7091621527632&mode=tool',
            uri: 'ui://product/gid://shopify/Product/7091621527632',
          },
        }),
        expect.any(Object),
      );
    });

    it('should handle production base64 tool call response with a ui resource with HTML to render', () => {
      const productionBase64 =
        'W3sidXJpIjoidWk6Ly9tY3AtYWhhcnZhcmQvd2VhdGhlci1jYXJkIiwibWltZVR5cGUiOiJ0ZXh0L2h0bWwiLCJ0ZXh0IjoiXG48c3R5bGU+XG4gICoge1xuICAgIGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gIH1cbiAgOnJvb3Qge1xuICAgIGZvbnQtZmFtaWx5OiBJbnRlciwgc2Fucy1zZXJpZjtcbiAgICBmb250LWZlYXR1cmUtc2V0dGluZ3M6ICdsaWdhJyAxLCAnY2FsdCcgMTsgLyogZml4IGZvciBDaHJvbWUgKi9cbiAgICAtLWNhcmQtYmFja2dyb3VuZC1jb2xvcjogIzAwMDAwMDtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2ZmZmZmZjtcbiAgfVxuICBAc3VwcG9ydHMgKGZvbnQtdmFyaWF0aW9uLXNldHRpbmdzOiBub3JtYWwpIHtcbiAgICA6cm9vdCB7IGZvbnQtZmFtaWx5OiBJbnRlclZhcmlhYmxlLCBzYW5zLXNlcmlmOyB9XG4gIH1cbiAgaHRtbCwgYm9keSB7XG4gICBvdmVyZmxvdzogaGlkZGVuO1xuICB9XG4gIGJvZHkge1xuICAgIG1hcmdpbjogMDtcbiAgICBwYWRkaW5nOiAwO1xuICAgIGJhY2tncm91bmQtY29sb3I6IHRyYW5zcGFyZW50O1xuICAgIGRpc3BsYXk6IGdyaWQ7XG4gIH1cbiAgLm1jcC11aS1jb250YWluZXJ7XG4gICAgLy8gbWF4LXdpZHRoOiA3MDBweDsgXG4gICAgY29udGFpbmVyLXR5cGU6IGlubGluZS1zaXplO1xuICAgIGNvbnRhaW5lci1uYW1lOiB3ZWF0aGVyLWNhcmQ7XG4gIH1cbiBcbiAgLndlYXRoZXItY2FyZCB7XG4gICAgbWFyZ2luOiAxMHB4O1xuICAgIHBvc2l0aW9uOiByZWxhdGl2ZTtcbiAgICBjb2xvcjogdmFyKC0tY2FyZC10ZXh0LWNvbG9yKTtcbiAgICBwYWRkaW5nOiAzMHB4IDMwcHggNDBweCAzMHB4O1xuICAgIGJvcmRlci1yYWRpdXM6IDRweDtcbiAgICBib3gtc2hhZG93OiAwIDAgMCAxMHB4IHJnYmEoMjU1LCAyNTUsIDI1NSwgLjE1KTtcbiAgICBkaXNwbGF5OiBncmlkO1xuICAgIGdhcDogOHB4O1xuICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyO1xuICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgZ3JpZC10ZW1wbGF0ZS1hcmVhczpcbiAgICAgIFwibG9jYXRpb25cIlxuICAgICAgXCJ0ZW1wZXJhdHVyZVwiXG4gICAgICBcImNvbmRpdGlvbi1jb250YWluZXIgXCJcbiAgfVxuICAud2VhdGhlci1jYXJkICoge1xuICAgIG1hcmdpbjogMDtcbiAgICBsaW5lLWhlaWdodDogMTtcbiAgfVxuICAubG9jYXRpb24ge1xuICAgIGZvbnQtc2l6ZTogNDhweDtcbiAgICBmb250LXdlaWdodDogNzAwO1xuICAgIGdyaWQtYXJlYTogbG9jYXRpb247XG4gIH1cbiAgLnRlbXBlcmF0dXJlIHtcbiAgICBncmlkLWFyZWE6IHRlbXBlcmF0dXJlO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgYWxpZ24taXRlbXM6IHRvcDtcbiAgICBtYXJnaW4tYm90dG9tOiAxNXB4O1xuICB9XG4gIC50ZW1wZXJhdHVyZS12YWx1ZSB7XG4gICAgZm9udC13ZWlnaHQ6IDkwMDtcbiAgICBmb250LXNpemU6IDMwY3F3O1xuICAgIGxpbmUtaGVpZ2h0OiAwLjg7XG4gICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDEwcHgpO1xuICAgIGZpbHRlcjogZHJvcC1zaGFkb3coMCAycHggMXB4IHJnYmEoMTIwLCAxMjAsIDEyMCwgMC4yNSkpO1xuICB9XG4gIC50ZW1wZXJhdHVyZS11bml0IHtcbiAgICBmb250LXNpemU6IDMwcHg7XG4gICAgbWFyZ2luLXRvcDogOHB4O1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1jb250YWluZXJ7XG4gICAgdGV4dC10cmFuc2Zvcm06IHVwcGVyY2FzZTtcbiAgICBmb250LXNpemU6IDE0cHg7XG4gICAgZm9udC13ZWlnaHQ6IDUwMDtcbiAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xuICAgIGFsaWduLXNlbGY6IGZsZXgtZW5kO1xuICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcbiAgICBnYXA6IDZweDtcbiAgICBncmlkLWFyZWE6IGNvbmRpdGlvbi1jb250YWluZXI7XG4gIH1cbiAgLmNvbmRpdGlvbiB7XG4gICAgZm9udC1zaXplOiAxOHB4O1xuICAgIGZvbnQtd2VpZ2h0OiA4MDA7XG4gICAgbWFyZ2luLWJvdHRvbTogNHB4O1xuICB9XG4gIC53aW5kLXNwZWVkLFxuICAuaHVtaWRpdHkge1xuICAgIGZvbnQtc2l6ZTogMTRweDtcbiAgICBmb250LXdlaWdodDogMjUwMDtcbiAgICBsZXR0ZXItc3BhY2luZzogMC4wNWVtO1xuICAgIG9wYWNpdHk6IDAuNzU7ICBcbiAgfVxuICBcbiAgICAvKiBSb3RhdGluZyBncmFkaWVudCBhbmltYXRpb24gdXNpbmcgcHNldWRvLWVsZW1lbnQgKi9cbiAgQGtleWZyYW1lcyByb3RhdGVHcmFkaWVudCB7XG4gICAgMCUge1xuICAgICAgdHJhbnNmb3JtOiByb3RhdGUoLTYwZGVnKTtcbiAgICAgIHNjYWxlOiAxO1xuICAgIH1cbiAgICAxMDAlIHtcbiAgICAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpO1xuICAgICAgc2NhbGU6IDEuNTtcbiAgICB9XG4gIH1cbiAgXG4gIC8qIFBzZXVkby1lbGVtZW50IGZvciBhbmltYXRlZCBncmFkaWVudCBiYWNrZ3JvdW5kICovXG4gIC53ZWF0aGVyLWNhcmQ6OmJlZm9yZSB7XG4gICAgY29udGVudDogJyc7XG4gICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgIC0tc2l6ZTogMjAwJTtcbiAgICB0b3A6IC01MGNxdztcbiAgICBsZWZ0OiBjYWxjKDUwJSAtIHZhcigtLXNpemUpIC8gMik7XG4gICAgd2lkdGg6IHZhcigtLXNpemUpO1xuICAgIGFzcGVjdC1yYXRpbzogMS8xO1xuICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICB6LWluZGV4OiAtMTtcbiAgICBiYWNrZ3JvdW5kOiBsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCB2YXIoLS1ncmFkaWVudC1jb2xvci0xKSwgdmFyKC0tZ3JhZGllbnQtY29sb3ItMiksIHZhcigtLWdyYWRpZW50LWNvbG9yLTMpKTtcbiAgICBhbmltYXRpb246IHJvdGF0ZUdyYWRpZW50IDNzIGVhc2UtaW4tb3V0IGluZmluaXRlIGFsdGVybmF0ZTtcbiAgfVxuICBcbiAgLyogQ2xlYXIgYW5kIFN1bm55IENvbmRpdGlvbnMgKi9cbiAgLndlYXRoZXItY29uZGl0aW9uLWNsZWFyLXNreSB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjMWU5MGZmO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzAwYmZmZjtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICM4N2NlZWI7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNlNmYzZmY7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLW1haW5seS1jbGVhciB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjODdjZWViO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogI2IwZTBlNjtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNmMGY4ZmY7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICMxYTNjNGE7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLXBhcnRseS1jbG91ZHkge1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMTogIzg3Y2VlYjtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTI6ICNiMGUwZTY7XG4gICAgLS1ncmFkaWVudC1jb2xvci0zOiAjZjBmOGZmO1xuICAgIC0tY2FyZC10ZXh0LWNvbG9yOiAjMWEzYzRhO1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1vdmVyY2FzdCB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjNzA4MDkwO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzc3ODg5OTtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNiMGM0ZGU7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNlOGYwZjg7XG4gIH1cblxuICAvKiBGb2cgQ29uZGl0aW9ucyAqL1xuICAud2VhdGhlci1jb25kaXRpb24tZm9nIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICNkM2QzZDM7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjZTZlNmU2O1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogI2Y1ZjVmNTtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogIzJkMmQyZDtcbiAgfVxuICAud2VhdGhlci1jb25kaXRpb24tZGVwb3NpdGluZy1yaW1lLWZvZyB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjZDNkM2QzO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogI2U2ZTZlNjtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNmNWY1ZjU7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICMyZDJkMmQ7XG4gIH1cblxuICAvKiBEcml6emxlIENvbmRpdGlvbnMgKi9cbiAgLndlYXRoZXItY29uZGl0aW9uLWxpZ2h0LWRyaXp6bGUge1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMTogIzVmOWVhMDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTI6ICM3ZmIzZDM7XG4gICAgLS1ncmFkaWVudC1jb2xvci0zOiAjYjBlMGU2O1xuICAgIC0tY2FyZC10ZXh0LWNvbG9yOiAjZTZmN2ZmO1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1tb2RlcmF0ZS1kcml6emxlIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICM1ZjllYTA7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjN2ZiM2QzO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogI2IwZTBlNjtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2U2ZjdmZjtcbiAgfVxuICAud2VhdGhlci1jb25kaXRpb24tZGVuc2UtZHJpenpsZSB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjNWY5ZWEwO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzdmYjNkMztcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNiMGUwZTY7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNlNmY3ZmY7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLWxpZ2h0LWZyZWV6aW5nLWRyaXp6bGUge1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMTogIzQ2ODJiNDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTI6ICM1ZjllYTA7XG4gICAgLS1ncmFkaWVudC1jb2xvci0zOiAjYjBjNGRlO1xuICAgIC0tY2FyZC10ZXh0LWNvbG9yOiAjZTZmM2ZmO1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1kZW5zZS1mcmVlemluZy1kcml6emxlIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICM0NjgyYjQ7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjNWY5ZWEwO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogI2IwYzRkZTtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2U2ZjNmZjtcbiAgfVxuXG4gIC8qIFJhaW4gQ29uZGl0aW9ucyAqL1xuICAud2VhdGhlci1jb25kaXRpb24tc2xpZ2h0LXJhaW4ge1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMTogIzQ2ODJiNDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTI6ICM1ZjllYTA7XG4gICAgLS1ncmFkaWVudC1jb2xvci0zOiAjODdjZWViO1xuICAgIC0tY2FyZC10ZXh0LWNvbG9yOiAjZTZmM2ZmO1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1tb2RlcmF0ZS1yYWluIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICM0NjgyYjQ7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjNWY5ZWEwO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogIzg3Y2VlYjtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2U2ZjNmZjtcbiAgfVxuICAud2VhdGhlci1jb25kaXRpb24taGVhdnktcmFpbiB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjMTkxOTcwO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzQxNjllMTtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICMxZTkwZmY7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNlNmYzZmY7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLWxpZ2h0LWZyZWV6aW5nLXJhaW4ge1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMTogIzQ2ODJiNDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTI6ICM1ZjllYTA7XG4gICAgLS1ncmFkaWVudC1jb2xvci0zOiAjYjBjNGRlO1xuICAgIC0tY2FyZC10ZXh0LWNvbG9yOiAjZTZmM2ZmO1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1oZWF2eS1mcmVlemluZy1yYWluIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICM0NjgyYjQ7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjNWY5ZWEwO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogI2IwYzRkZTtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2U2ZjNmZjtcbiAgfVxuXG4gIC8qIFNub3cgQ29uZGl0aW9ucyAqL1xuICAud2VhdGhlci1jb25kaXRpb24tc2xpZ2h0LXNub3cge1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMTogI2YwZjhmZjtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTI6ICNlNmU2ZmE7XG4gICAgLS1ncmFkaWVudC1jb2xvci0zOiAjZmZmZmZmO1xuICAgIC0tY2FyZC10ZXh0LWNvbG9yOiAjMWExYTJlO1xuICB9XG4gIC53ZWF0aGVyLWNvbmRpdGlvbi1tb2RlcmF0ZS1zbm93IHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICNmMGY4ZmY7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjZTZlNmZhO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogI2ZmZmZmZjtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogIzFhMWEyZTtcbiAgfVxuICAud2VhdGhlci1jb25kaXRpb24taGVhdnktc25vdyB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjZjBmOGZmO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogI2U2ZTZmYTtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNmZmZmZmY7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICMxYTFhMmU7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLXNub3ctZ3JhaW5zIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICNmMGY4ZmY7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjZTZlNmZhO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogI2ZmZmZmZjtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogIzFhMWEyZTtcbiAgfVxuXG4gIC8qIFJhaW4gU2hvd2VycyAqL1xuICAud2VhdGhlci1jb25kaXRpb24tc2xpZ2h0LXJhaW4tc2hvd2VycyB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjNDY4MmI0O1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzVmOWVhMDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICM4N2NlZWI7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNlNmYzZmY7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLW1vZGVyYXRlLXJhaW4tc2hvd2VycyB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjNDY4MmI0O1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzVmOWVhMDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICM4N2NlZWI7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNlNmYzZmY7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLXZpb2xlbnQtcmFpbi1zaG93ZXJzIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICMxOTE5NzA7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjNDE2OWUxO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogIzFlOTBmZjtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2U2ZjNmZjtcbiAgfVxuXG4gIC8qIFNub3cgU2hvd2VycyAqL1xuICAud2VhdGhlci1jb25kaXRpb24tc2xpZ2h0LXNub3ctc2hvd2VycyB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjZjBmOGZmO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogI2U2ZTZmYTtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNmZmZmZmY7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICMxYTFhMmU7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLWhlYXZ5LXNub3ctc2hvd2VycyB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjZjBmOGZmO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogI2U2ZTZmYTtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICNmZmZmZmY7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICMxYTFhMmU7XG4gIH1cblxuICAvKiBUaHVuZGVyc3Rvcm0gQ29uZGl0aW9ucyAqL1xuICAud2VhdGhlci1jb25kaXRpb24tc2xpZ2h0LXRodW5kZXJzdG9ybSB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjMmYyZjJmO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzRiMDA4MjtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICM4YTJiZTI7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNmMGU2ZmY7XG4gIH1cbiAgLndlYXRoZXItY29uZGl0aW9uLXRodW5kZXJzdG9ybS13aXRoLXNsaWdodC1oYWlsIHtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTE6ICM0ODNkOGI7XG4gICAgLS1ncmFkaWVudC1jb2xvci0yOiAjNmE1YWNkO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMzogIzkzNzBkYjtcbiAgICAtLWNhcmQtdGV4dC1jb2xvcjogI2YwZTZmZjtcbiAgfVxuICAud2VhdGhlci1jb25kaXRpb24tdGh1bmRlcnN0b3JtLXdpdGgtaGVhdnktaGFpbCB7XG4gICAgLS1ncmFkaWVudC1jb2xvci0xOiAjNDgzZDhiO1xuICAgIC0tZ3JhZGllbnQtY29sb3ItMjogIzZhNWFjZDtcbiAgICAtLWdyYWRpZW50LWNvbG9yLTM6ICM5MzcwZGI7XG4gICAgLS1jYXJkLXRleHQtY29sb3I6ICNmMGU2ZmY7XG4gIH0gXG5cbiAgIEBjb250YWluZXIgd2VhdGhlci1jYXJkIChtaW4td2lkdGg6IDYwMHB4KSB7XG4gICAgLndlYXRoZXItY2FyZCB7XG4gICAgIGdyaWQtdGVtcGxhdGUtY29sdW1uczogMWZyIGF1dG87XG4gICAgIGdyaWQtdGVtcGxhdGUtYXJlYXM6XG4gICAgICBcImxvY2F0aW9uIHRlbXBlcmF0dXJlXCJcbiAgICAgIFwiY29uZGl0aW9uLWNvbnRhaW5lciB0ZW1wZXJhdHVyZSBcIlxuICAgIH1cbiAgICAudGVtcGVyYXR1cmUge1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LWVuZDtcbiAgICAgIG1hcmdpbi1ib3R0b206IDBweDtcbiAgICB9XG4gICAgLnRlbXBlcmF0dXJlLXZhbHVlIHtcbiAgICAgIGZvbnQtc2l6ZTogMjBjcXc7XG4gICAgfVxuICB9XG5cbiAgXG48L3N0eWxlPlxuICBcbjxhcnRpY2xlIGNsYXNzPVwibWNwLXVpLWNvbnRhaW5lclwiPlxuICA8ZGl2IGNsYXNzPVwid2VhdGhlci1jYXJkIHdlYXRoZXItY29uZGl0aW9uLXBhcnRseS1jbG91ZHlcIj5cbiAgICA8cCBjbGFzcz1cImxvY2F0aW9uXCI+UGFyaXM8L3A+XG4gICAgPHAgY2xhc3M9XCJ0ZW1wZXJhdHVyZVwiPlxuICAgICAgPHNwYW4gY2xhc3M9XCJ0ZW1wZXJhdHVyZS12YWx1ZVwiPjY5PC9zcGFuPlxuICAgICAgPHNwYW4gY2xhc3M9XCJ0ZW1wZXJhdHVyZS11bml0XCI+wrBGPC9zcGFuPlxuICAgIDwvcD5cbiAgICA8ZGl2IGNsYXNzPVwid2VhdGhlci1jb25kaXRpb24tY29udGFpbmVyXCI+XG4gICAgICA8cCBjbGFzcz1cImNvbmRpdGlvblwiPlBhcnRseSBDbG91ZHk8L3A+XG4gICAgICA8cCBjbGFzcz1cIndpbmQtc3BlZWRcIj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJ3aW5kLXNwZWVkLXZhbHVlXCI+ODwvc3Bhbj5cbiAgICAgICAgPHNwYW4gY2xhc3M9XCJ3aW5kLXNwZWVkLXVuaXRcIj5tcGg8L3NwYW4+XG4gICAgICAgIDxzcGFuIGNsYXNzPVwid2luZC1zcGVlZC1sYWJlbFwiPldpbmRzPC9zcGFuPlxuICAgICAgPC9wPlxuICAgICAgPHAgY2xhc3M9XCJodW1pZGl0eVwiPlxuICAgICAgPHNwYW4gY2xhc3M9XCJodW1pZGl0eS12YWx1ZVwiPjU1JTwvc3Bhbj5cbiAgICAgIDxzcGFuIGNsYXNzPVwiaHVtaWRpdHktbGFiZWxcIj5IdW1pZGl0eTwvc3Bhbj5cbiAgICAgIDwvcD5cbiAgICA8L2Rpdj5cbiAgPC9kaXY+XG48L2FydGljbGU+XG4gIFxuPHNjcmlwdD5cbiAgY29uc3QgbWNwVWlDb250YWluZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcubWNwLXVpLWNvbnRhaW5lcicpO1xuICBcbiAgZnVuY3Rpb24gcG9zdFNpemUoKSB7XG4gICAgY29uc3QgaGVpZ2h0ID0gbWNwVWlDb250YWluZXIuc2Nyb2xsSGVpZ2h0O1xuICAgIGNvbnN0IHdpZHRoID0gbWNwVWlDb250YWluZXIuc2Nyb2xsV2lkdGg7XG4gICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZShcbiAgICAgIHtcbiAgICAgICAgdHlwZTogXCJ1aS1zaXplLWNoYW5nZVwiLFxuICAgICAgICBwYXlsb2FkOiB7XG4gICAgICAgICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgICAgICAgd2lkdGg6IHdpZHRoLCBcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBcIipcIixcbiAgICApO1xuICB9XG5cbiAgLy8gQ3JlYXRlIFJlc2l6ZU9ic2VydmVyIHRvIHdhdGNoIGZvciBzaXplIGNoYW5nZXNcbiAgY29uc3QgcmVzaXplT2JzZXJ2ZXIgPSBuZXcgUmVzaXplT2JzZXJ2ZXIoKGVudHJpZXMpID0+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpIHtcbiAgICAgIC8vIFBvc3Qgc2l6ZSB3aGVuZXZlciBkb2N1bWVudCBzaXplIGNoYW5nZXNcbiAgICAgIHBvc3RTaXplKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBTdGFydCBvYnNlcnZpbmcgdGhlIG1jcC11aS1jb250YWluZXIgZWxlbWVudFxuICByZXNpemVPYnNlcnZlci5vYnNlcnZlKG1jcFVpQ29udGFpbmVyKTtcbjwvc2NyaXB0PlxuPHNjcmlwdD5cbiAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcbiAgbGluay5yZWwgPSAncHJlY29ubmVjdCc7XG4gIGxpbmsuaHJlZiA9ICdodHRwczovL3JzbXMubWUvJztcbiAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcblxuICBjb25zdCBsaW5rMiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcbiAgbGluazIucmVsID0gJ3N0eWxlc2hlZXQnO1xuICBsaW5rMi5ocmVmID0gJ2h0dHBzOi8vcnNtcy5tZS9pbnRlci9pbnRlci5jc3MnO1xuICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKGxpbmsyKTtcbjwvc2NyaXB0PiJ9XQ==';

      const output = JSON.stringify([
        {
          metadata: 'ui_resources',
          text: productionBase64,
        },
      ]);

      render(<ToolCallInfo {...mockProps} output={output} />);

      expect(UIResourceRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: {
            uri: 'ui://mcp-aharvard/weather-card',
            mimeType: 'text/html',
            text: '\n<style>\n  * {\n    box-sizing: border-box;\n  }\n  :root {\n    font-family: Inter, sans-serif;\n    font-feature-settings: \'liga\' 1, \'calt\' 1; /* fix for Chrome */\n    --card-background-color: #000000;\n    --card-text-color: #ffffff;\n  }\n  @supports (font-variation-settings: normal) {\n    :root { font-family: InterVariable, sans-serif; }\n  }\n  html, body {\n   overflow: hidden;\n  }\n  body {\n    margin: 0;\n    padding: 0;\n    background-color: transparent;\n    display: grid;\n  }\n  .mcp-ui-container{\n    // max-width: 700px; \n    container-type: inline-size;\n    container-name: weather-card;\n  }\n \n  .weather-card {\n    margin: 10px;\n    position: relative;\n    color: var(--card-text-color);\n    padding: 30px 30px 40px 30px;\n    border-radius: 4px;\n    box-shadow: 0 0 0 10px rgba(255, 255, 255, .15);\n    display: grid;\n    gap: 8px;\n    grid-template-columns: 1fr;\n    overflow: hidden;\n    grid-template-areas:\n      "location"\n      "temperature"\n      "condition-container "\n  }\n  .weather-card * {\n    margin: 0;\n    line-height: 1;\n  }\n  .location {\n    font-size: 48px;\n    font-weight: 700;\n    grid-area: location;\n  }\n  .temperature {\n    grid-area: temperature;\n    display: flex;\n    align-items: top;\n    margin-bottom: 15px;\n  }\n  .temperature-value {\n    font-weight: 900;\n    font-size: 30cqw;\n    line-height: 0.8;\n    transform: translateY(10px);\n    filter: drop-shadow(0 2px 1px rgba(120, 120, 120, 0.25));\n  }\n  .temperature-unit {\n    font-size: 30px;\n    margin-top: 8px;\n  }\n  .weather-condition-container{\n    text-transform: uppercase;\n    font-size: 14px;\n    font-weight: 500;\n    letter-spacing: 0.05em;\n    align-self: flex-end;\n    display: flex;\n    flex-direction: column;\n    gap: 6px;\n    grid-area: condition-container;\n  }\n  .condition {\n    font-size: 18px;\n    font-weight: 800;\n    margin-bottom: 4px;\n  }\n  .wind-speed,\n  .humidity {\n    font-size: 14px;\n    font-weight: 2500;\n    letter-spacing: 0.05em;\n    opacity: 0.75;  \n  }\n  \n    /* Rotating gradient animation using pseudo-element */\n  @keyframes rotateGradient {\n    0% {\n      transform: rotate(-60deg);\n      scale: 1;\n    }\n    100% {\n      transform: rotate(0deg);\n      scale: 1.5;\n    }\n  }\n  \n  /* Pseudo-element for animated gradient background */\n  .weather-card::before {\n    content: \'\';\n    position: absolute;\n    --size: 200%;\n    top: -50cqw;\n    left: calc(50% - var(--size) / 2);\n    width: var(--size);\n    aspect-ratio: 1/1;\n    transform-origin: center;\n    z-index: -1;\n    background: linear-gradient(135deg, var(--gradient-color-1), var(--gradient-color-2), var(--gradient-color-3));\n    animation: rotateGradient 3s ease-in-out infinite alternate;\n  }\n  \n  /* Clear and Sunny Conditions */\n  .weather-condition-clear-sky {\n    --gradient-color-1: #1e90ff;\n    --gradient-color-2: #00bfff;\n    --gradient-color-3: #87ceeb;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-mainly-clear {\n    --gradient-color-1: #87ceeb;\n    --gradient-color-2: #b0e0e6;\n    --gradient-color-3: #f0f8ff;\n    --card-text-color: #1a3c4a;\n  }\n  .weather-condition-partly-cloudy {\n    --gradient-color-1: #87ceeb;\n    --gradient-color-2: #b0e0e6;\n    --gradient-color-3: #f0f8ff;\n    --card-text-color: #1a3c4a;\n  }\n  .weather-condition-overcast {\n    --gradient-color-1: #708090;\n    --gradient-color-2: #778899;\n    --gradient-color-3: #b0c4de;\n    --card-text-color: #e8f0f8;\n  }\n\n  /* Fog Conditions */\n  .weather-condition-fog {\n    --gradient-color-1: #d3d3d3;\n    --gradient-color-2: #e6e6e6;\n    --gradient-color-3: #f5f5f5;\n    --card-text-color: #2d2d2d;\n  }\n  .weather-condition-depositing-rime-fog {\n    --gradient-color-1: #d3d3d3;\n    --gradient-color-2: #e6e6e6;\n    --gradient-color-3: #f5f5f5;\n    --card-text-color: #2d2d2d;\n  }\n\n  /* Drizzle Conditions */\n  .weather-condition-light-drizzle {\n    --gradient-color-1: #5f9ea0;\n    --gradient-color-2: #7fb3d3;\n    --gradient-color-3: #b0e0e6;\n    --card-text-color: #e6f7ff;\n  }\n  .weather-condition-moderate-drizzle {\n    --gradient-color-1: #5f9ea0;\n    --gradient-color-2: #7fb3d3;\n    --gradient-color-3: #b0e0e6;\n    --card-text-color: #e6f7ff;\n  }\n  .weather-condition-dense-drizzle {\n    --gradient-color-1: #5f9ea0;\n    --gradient-color-2: #7fb3d3;\n    --gradient-color-3: #b0e0e6;\n    --card-text-color: #e6f7ff;\n  }\n  .weather-condition-light-freezing-drizzle {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #b0c4de;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-dense-freezing-drizzle {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #b0c4de;\n    --card-text-color: #e6f3ff;\n  }\n\n  /* Rain Conditions */\n  .weather-condition-slight-rain {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #87ceeb;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-moderate-rain {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #87ceeb;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-heavy-rain {\n    --gradient-color-1: #191970;\n    --gradient-color-2: #4169e1;\n    --gradient-color-3: #1e90ff;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-light-freezing-rain {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #b0c4de;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-heavy-freezing-rain {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #b0c4de;\n    --card-text-color: #e6f3ff;\n  }\n\n  /* Snow Conditions */\n  .weather-condition-slight-snow {\n    --gradient-color-1: #f0f8ff;\n    --gradient-color-2: #e6e6fa;\n    --gradient-color-3: #ffffff;\n    --card-text-color: #1a1a2e;\n  }\n  .weather-condition-moderate-snow {\n    --gradient-color-1: #f0f8ff;\n    --gradient-color-2: #e6e6fa;\n    --gradient-color-3: #ffffff;\n    --card-text-color: #1a1a2e;\n  }\n  .weather-condition-heavy-snow {\n    --gradient-color-1: #f0f8ff;\n    --gradient-color-2: #e6e6fa;\n    --gradient-color-3: #ffffff;\n    --card-text-color: #1a1a2e;\n  }\n  .weather-condition-snow-grains {\n    --gradient-color-1: #f0f8ff;\n    --gradient-color-2: #e6e6fa;\n    --gradient-color-3: #ffffff;\n    --card-text-color: #1a1a2e;\n  }\n\n  /* Rain Showers */\n  .weather-condition-slight-rain-showers {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #87ceeb;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-moderate-rain-showers {\n    --gradient-color-1: #4682b4;\n    --gradient-color-2: #5f9ea0;\n    --gradient-color-3: #87ceeb;\n    --card-text-color: #e6f3ff;\n  }\n  .weather-condition-violent-rain-showers {\n    --gradient-color-1: #191970;\n    --gradient-color-2: #4169e1;\n    --gradient-color-3: #1e90ff;\n    --card-text-color: #e6f3ff;\n  }\n\n  /* Snow Showers */\n  .weather-condition-slight-snow-showers {\n    --gradient-color-1: #f0f8ff;\n    --gradient-color-2: #e6e6fa;\n    --gradient-color-3: #ffffff;\n    --card-text-color: #1a1a2e;\n  }\n  .weather-condition-heavy-snow-showers {\n    --gradient-color-1: #f0f8ff;\n    --gradient-color-2: #e6e6fa;\n    --gradient-color-3: #ffffff;\n    --card-text-color: #1a1a2e;\n  }\n\n  /* Thunderstorm Conditions */\n  .weather-condition-slight-thunderstorm {\n    --gradient-color-1: #2f2f2f;\n    --gradient-color-2: #4b0082;\n    --gradient-color-3: #8a2be2;\n    --card-text-color: #f0e6ff;\n  }\n  .weather-condition-thunderstorm-with-slight-hail {\n    --gradient-color-1: #483d8b;\n    --gradient-color-2: #6a5acd;\n    --gradient-color-3: #9370db;\n    --card-text-color: #f0e6ff;\n  }\n  .weather-condition-thunderstorm-with-heavy-hail {\n    --gradient-color-1: #483d8b;\n    --gradient-color-2: #6a5acd;\n    --gradient-color-3: #9370db;\n    --card-text-color: #f0e6ff;\n  } \n\n   @container weather-card (min-width: 600px) {\n    .weather-card {\n     grid-template-columns: 1fr auto;\n     grid-template-areas:\n      "location temperature"\n      "condition-container temperature "\n    }\n    .temperature {\n      justify-content: flex-end;\n      margin-bottom: 0px;\n    }\n    .temperature-value {\n      font-size: 20cqw;\n    }\n  }\n\n  \n</style>\n  \n<article class="mcp-ui-container">\n  <div class="weather-card weather-condition-partly-cloudy">\n    <p class="location">Paris</p>\n    <p class="temperature">\n      <span class="temperature-value">69</span>\n      <span class="temperature-unit">°F</span>\n    </p>\n    <div class="weather-condition-container">\n      <p class="condition">Partly Cloudy</p>\n      <p class="wind-speed">\n        <span class="wind-speed-value">8</span>\n        <span class="wind-speed-unit">mph</span>\n        <span class="wind-speed-label">Winds</span>\n      </p>\n      <p class="humidity">\n      <span class="humidity-value">55%</span>\n      <span class="humidity-label">Humidity</span>\n      </p>\n    </div>\n  </div>\n</article>\n  \n<script>\n  const mcpUiContainer = document.querySelector(\'.mcp-ui-container\');\n  \n  function postSize() {\n    const height = mcpUiContainer.scrollHeight;\n    const width = mcpUiContainer.scrollWidth;\n    window.parent.postMessage(\n      {\n        type: "ui-size-change",\n        payload: {\n          height: height,\n          width: width, \n        },\n      },\n      "*",\n    );\n  }\n\n  // Create ResizeObserver to watch for size changes\n  const resizeObserver = new ResizeObserver((entries) => {\n    for (const entry of entries) {\n      // Post size whenever document size changes\n      postSize();\n    }\n  });\n\n  // Start observing the mcp-ui-container element\n  resizeObserver.observe(mcpUiContainer);\n</script>\n<script>\n  const link = document.createElement(\'link\');\n  link.rel = \'preconnect\';\n  link.href = \'https://rsms.me/\';\n  document.head.appendChild(link);\n\n  const link2 = document.createElement(\'link\');\n  link2.rel = \'stylesheet\';\n  link2.href = \'https://rsms.me/inter/inter.css\';\n  document.head.appendChild(link2);\n</script>',
          },
        }),
        expect.any(Object),
      );
    });
  });
});
