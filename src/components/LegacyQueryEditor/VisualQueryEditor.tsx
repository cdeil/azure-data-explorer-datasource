import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { TextArea, useStyles2 } from '@grafana/ui';
import {
  QueryEditorArrayExpression,
  QueryEditorExpression,
  QueryEditorExpressionType,
  QueryEditorGroupByExpressionArray,
  QueryEditorOperatorExpression,
  QueryEditorPropertyExpression,
  QueryEditorReduceExpressionArray,
  QueryEditorWhereArrayExpression,
} from 'components/LegacyQueryEditor/editor/expressions';
import React, { useCallback, useMemo, useEffect } from 'react';
import { useAsync } from 'react-use';
import { selectors } from 'test/selectors';

import { QueryEditorResultFormat, selectResultFormat } from '../LegacyQueryEditor/QueryEditorResultFormat';
import { SchemaError, SchemaLoading, SchemaWarning } from '../LegacyQueryEditor/SchemaMessages';
import { AdxDataSource } from '../../datasource';
import { definitionToProperty } from './editor/components/field/QueryEditorField';
import { isFieldExpression } from './editor/guards';
import { QueryEditorPropertyDefinition, QueryEditorPropertyType } from '../../schema/types';
import { AdxSchemaResolver } from '../../schema/AdxSchemaResolver';
import { columnsToDefinition } from '../../schema/mapper';
import { AdxColumnSchema, AdxSchema, defaultQuery, KustoQuery } from '../../types';
import {
  KustoGroupByEditorSection,
  KustoPropertyEditorSection,
  KustoValueColumnEditorSection,
  KustoWhereEditorSection,
} from './VisualQueryEditorSections';

interface Props {
  database: string;
  query: KustoQuery;
  onChangeQuery: (query: KustoQuery) => void;
  schema?: AdxSchema;
  datasource: AdxDataSource;
  templateVariableOptions: SelectableValue<string>;
}

export const VisualQueryEditor: React.FC<Props> = (props) => {
  const { query, database, datasource, schema, onChangeQuery } = props;
  const { id: datasourceId, parseExpression, autoCompleteQuery, getSchemaMapper } = datasource;

  const resultFormat = selectResultFormat(query.resultFormat);
  const databaseName = getTemplateSrv().replace(database);
  const tables = useTableOptions(schema, databaseName, datasource);
  const table = useSelectedTable(tables, query, datasource);
  const tableName = getTemplateSrv().replace(table?.property.name ?? '');
  const tableMapping = getSchemaMapper().getMappingByValue(table?.property.name);
  const timeshiftOptions = useTimeshiftOptions();
  const styles = useStyles2(getStyles);

  // Set initial data
  useEffect(() => {
    if (database && resultFormat && table?.property.name && !query.expression.from) {
      onChangeQuery({
        ...query,
        database,
        resultFormat,
        expression: {
          ...query.expression,
          from: {
            type: QueryEditorExpressionType.Property,
            property: {
              name: table.property.name,
              type: QueryEditorPropertyType.String,
            },
          },
        },
      });
    }
  }, [database, resultFormat, table?.property.name, query, onChangeQuery]);

  const tableSchema = useAsync(async () => {
    if (!table || !table.property) {
      return [];
    }

    const name = tableMapping?.value ?? tableName;
    const schema = await getTableSchema(datasource, databaseName, name);
    const expression = query.expression ?? defaultQuery.expression;

    onChangeQuery({
      ...query,
      query: parseExpression(
        {
          ...expression,
          from: table,
        },
        schema
      ),
    });

    return schema;
  }, [datasourceId, databaseName, tableName, tableMapping?.value]);

  const onAutoComplete = useCallback(
    async (index: string, search: QueryEditorOperatorExpression) => {
      const values = await autoCompleteQuery(
        {
          search,
          database: databaseName,
          expression: query.expression,
          index,
        },
        tableSchema.value
      );

      return values.map((value) => ({ value, label: value }));
    },
    [autoCompleteQuery, databaseName, tableSchema.value, query.expression]
  );

  const columns = useColumnOptions(tableSchema.value);
  const groupable = useGroupableColumns(columns);
  const aggregable = useAggregableColumns(columns);

  const onChangeTable = useCallback(
    (expression: QueryEditorExpression) => {
      if (!isFieldExpression(expression) || !table) {
        return;
      }

      const next = {
        ...defaultQuery.expression,
        from: expression,
      };

      onChangeQuery({
        ...query,
        resultFormat: resultFormat,
        database: database,
        expression: next,
      });
    },
    [onChangeQuery, query, resultFormat, database, table]
  );

  const onWhereChange = useCallback(
    (expression: QueryEditorArrayExpression) => {
      const next = {
        ...query.expression,
        from: table,
        where: expression as QueryEditorWhereArrayExpression,
      };

      onChangeQuery({
        ...query,
        resultFormat: resultFormat,
        database: database,
        expression: next,
        query: parseExpression(next, tableSchema.value),
      });
    },
    [onChangeQuery, query, tableSchema.value, resultFormat, database, table, parseExpression]
  );

  const onReduceChange = useCallback(
    (expression: QueryEditorArrayExpression) => {
      const next = {
        ...query.expression,
        from: table,
        reduce: expression as QueryEditorReduceExpressionArray,
      };

      onChangeQuery({
        ...query,
        resultFormat: resultFormat,
        database: database,
        expression: next,
        query: parseExpression(next, tableSchema.value),
      });
    },
    [onChangeQuery, query, tableSchema.value, resultFormat, database, table, parseExpression]
  );

  const onGroupByChange = useCallback(
    (expression: QueryEditorArrayExpression) => {
      const next = {
        ...query.expression,
        from: table,
        groupBy: expression as QueryEditorGroupByExpressionArray,
      };

      onChangeQuery({
        ...query,
        resultFormat: resultFormat,
        database: database,
        expression: next,
        query: parseExpression(next, tableSchema.value),
      });
    },
    [onChangeQuery, query, tableSchema.value, resultFormat, database, table, parseExpression]
  );

  const onChangeResultFormat = useCallback(
    (format: string) => {
      const next = {
        ...query.expression,
        from: table,
      };

      onChangeQuery({
        ...query,
        expression: next,
        database: database,
        resultFormat: format,
      });
    },
    [onChangeQuery, table, database, query]
  );

  const onChangeTimeshift = useCallback(
    (expression: QueryEditorExpression) => {
      if (!isFieldExpression(expression) || !table) {
        return;
      }

      const next = {
        ...defaultQuery.expression,
        ...query.expression,
        from: table,
        timeshift: expression,
      };

      onChangeQuery({
        ...query,
        resultFormat: resultFormat,
        database: database,
        expression: next,
        query: parseExpression(next, tableSchema.value),
      });
    },
    [onChangeQuery, query, resultFormat, database, table, parseExpression, tableSchema.value]
  );

  const KustoTable = (kustoTableProps: { children?: React.ReactElement }) => (
    <KustoPropertyEditorSection
      templateVariableOptions={props.templateVariableOptions}
      label="From"
      value={table}
      fields={tables}
      onChange={onChangeTable}
      aria-label={selectors.components.queryEditor.tableFrom.input}
    >
      {kustoTableProps.children}
    </KustoPropertyEditorSection>
  );

  if (tableSchema.loading) {
    return (
      <>
        <KustoTable />
        <SchemaLoading />
      </>
    );
  }

  if (tableSchema.error) {
    return (
      <>
        <KustoTable />
        <SchemaError message={`Could not load table schema: ${tableSchema.error?.message}`} />
      </>
    );
  }

  if (tableSchema.value?.length === 0) {
    return (
      <>
        <KustoTable />
        <SchemaWarning message="Table schema loaded successfully but without any columns" />
      </>
    );
  }

  return (
    <>
      <KustoTable>
        <QueryEditorResultFormat
          format={resultFormat}
          includeAdxTimeFormat={false}
          onChangeFormat={onChangeResultFormat}
        />
      </KustoTable>
      <KustoWhereEditorSection
        templateVariableOptions={props.templateVariableOptions}
        label="Where (filter)"
        value={query.expression?.where ?? defaultQuery.expression?.where}
        fields={columns}
        onChange={onWhereChange}
        getSuggestions={onAutoComplete}
      />
      <KustoValueColumnEditorSection
        templateVariableOptions={props.templateVariableOptions}
        label="Aggregate"
        value={query.expression?.reduce ?? defaultQuery.expression?.reduce}
        fields={aggregable}
        onChange={onReduceChange}
      />
      <KustoGroupByEditorSection
        templateVariableOptions={props.templateVariableOptions}
        label="Group by"
        value={query.expression?.groupBy ?? defaultQuery.expression?.groupBy}
        fields={groupable}
        onChange={onGroupByChange}
      />
      <hr />
      <KustoPropertyEditorSection
        templateVariableOptions={[]}
        label="Timeshift"
        value={query.expression?.timeshift ?? defaultQuery.expression?.timeshift}
        fields={timeshiftOptions}
        onChange={onChangeTimeshift}
        allowCustom={true}
      />
      <div className={styles.query}>
        <TextArea cols={80} rows={8} value={props.query.query} disabled={true} />
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  query: css`
    margin-top: 12px;
  `,
});

const useGroupableColumns = (columns: QueryEditorPropertyDefinition[]): QueryEditorPropertyDefinition[] => {
  return useMemo(() => {
    return columns.filter((c) => c.type === QueryEditorPropertyType.DateTime || QueryEditorPropertyType.String);
  }, [columns]);
};

const useAggregableColumns = (columns: QueryEditorPropertyDefinition[]): QueryEditorPropertyDefinition[] => {
  return useMemo(() => {
    return columns.filter((c) => c.type === QueryEditorPropertyType.DateTime || QueryEditorPropertyType.String);
  }, [columns]);
};

const useColumnOptions = (tableSchema?: AdxColumnSchema[]): QueryEditorPropertyDefinition[] => {
  return useMemo(() => {
    if (!tableSchema) {
      return [];
    }
    return columnsToDefinition(tableSchema);
  }, [tableSchema]);
};

const useSelectedTable = (
  options: QueryEditorPropertyDefinition[],
  query: KustoQuery,
  datasource: AdxDataSource
): QueryEditorPropertyExpression | undefined => {
  const variables = datasource.getVariables();

  const from = query.expression?.from?.property.name;

  return useMemo(() => {
    const selected = options.find((option) => option.value === from);

    if (selected) {
      return {
        type: QueryEditorExpressionType.Property,
        property: definitionToProperty(selected),
      };
    }

    const variable = variables.find((variable) => variable === from);

    if (variable) {
      return {
        type: QueryEditorExpressionType.Property,
        property: {
          name: variable,
          type: QueryEditorPropertyType.String,
        },
      };
    }

    if (options.length > 0) {
      return {
        type: QueryEditorExpressionType.Property,
        property: definitionToProperty(options[0]),
      };
    }

    return;
  }, [options, from, variables]);
};

const useTableOptions = (
  schema: AdxSchema | undefined,
  database: string,
  datasource: AdxDataSource
): QueryEditorPropertyDefinition[] => {
  const mapper = datasource.getSchemaMapper();

  return useMemo(() => {
    if (!schema || !schema.Databases) {
      return [];
    }
    return mapper.getTableOptions(schema, database);
  }, [database, schema, mapper]);
};

async function getTableSchema(datasource: AdxDataSource, databaseName: string, tableName: string) {
  const schemaResolver = new AdxSchemaResolver(datasource);
  return await schemaResolver.getColumnsForTable(databaseName, tableName);
}

const useTimeshiftOptions = (): QueryEditorPropertyDefinition[] => {
  return useMemo((): QueryEditorPropertyDefinition[] => {
    return [
      {
        label: 'No timeshift',
        value: '',
        type: QueryEditorPropertyType.TimeSpan,
      },
      {
        label: 'Hour before',
        value: '1h',
        type: QueryEditorPropertyType.TimeSpan,
      },
      {
        label: 'Day before',
        value: '1d',
        type: QueryEditorPropertyType.TimeSpan,
      },
      {
        label: 'Week before',
        value: '7d',
        type: QueryEditorPropertyType.TimeSpan,
      },
    ];
  }, []);
};
