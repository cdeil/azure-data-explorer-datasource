import { render, screen } from '@testing-library/react';
import { mockQuery } from 'components/__fixtures__/Datasource';
import { AdxColumnSchema } from 'types';
import React from 'react';
import { openMenu } from 'react-select-event';
import { QueryEditorPropertyType } from 'schema/types';
import GroupByItem from './GroupByItem';

const defaultProps = {
  query: mockQuery,
  groupBy: {},
  columns: [],
  templateVariableOptions: {},
  onChange: jest.fn(),
  onDelete: jest.fn(),
};

describe('GroupByItem', () => {
  it('should select a column', () => {
    const onChange = jest.fn();
    const columns: AdxColumnSchema[] = [
      {
        Name: 'foo',
        CslType: 'string',
      },
    ];
    render(<GroupByItem {...defaultProps} columns={columns} onChange={onChange} />);
    const sel = screen.getByLabelText('column');
    openMenu(sel);
    screen.getByText('foo').click();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ property: { name: 'foo', type: QueryEditorPropertyType.String } })
    );
  });

  it('should select a template variable', async () => {
    const onChange = jest.fn();
    const templateVariableOptions = {
      label: 'Template Variables',
      options: [{ label: '$foo', value: '$foo' }],
    };
    render(<GroupByItem {...defaultProps} onChange={onChange} templateVariableOptions={templateVariableOptions} />);
    const sel = screen.getByLabelText('column');
    openMenu(sel);
    (await screen.findByText('Template Variables')).click();
    (await screen.findByText('$foo')).click();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ property: { name: '$foo', type: QueryEditorPropertyType.String } })
    );
  });

  it('should add an interval when using a DateTime', () => {
    const onChange = jest.fn();
    const groupBy = {
      property: { name: 'Time', type: QueryEditorPropertyType.DateTime },
    };
    render(<GroupByItem {...defaultProps} onChange={onChange} groupBy={groupBy} />);
    const sel = screen.getByLabelText('interval');
    openMenu(sel);
    screen.getByText('1 minute').click();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ interval: { name: '1m', type: QueryEditorPropertyType.Interval } })
    );
  });
});
