import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { InlineFormLabel, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  QueryEditorExpressionType,
  QueryEditorFunctionParameterExpression,
  QueryEditorReduceExpression,
} from '../../expressions';
import {
  QueryEditorFunctionDefinition,
  QueryEditorFunctionParameter,
  QueryEditorProperty,
  QueryEditorPropertyDefinition,
  QueryEditorPropertyType,
} from '../../../../../schema/types';
import { QueryEditorField } from '../field/QueryEditorField';
import { QueryEditorFunctionParameterSection } from '../field/QueryEditorFunctionParameterSection';

interface Props {
  fields: QueryEditorPropertyDefinition[];
  templateVariableOptions: SelectableValue<string>;
  functions: QueryEditorFunctionDefinition[];
  value?: QueryEditorReduceExpression;
  label?: string;
  onChange: (expression: QueryEditorReduceExpression) => void;
}

export const QueryEditorReduce: React.FC<Props> = (props) => {
  const { value, functions, onChange } = props;
  const [field, setField] = useState(props.value?.property);
  const [reduce, setReduce] = useState(props.value?.reduce);
  const [parameters, setParameters] = useState(props.value?.parameters);
  const applyOnField = useApplyOnField(reduce, props.functions);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (props.value) {
      setField(props.value.property);
      setReduce(props.value.reduce);
      setParameters(props.value.parameters);
    }
  }, [props.value]);

  const onChangeField = useCallback(
    (property: QueryEditorProperty) => {
      setField(property);

      // Set a reasonable value
      if (!value?.reduce?.name) {
        let reducer = functions.find((f) => f.value === 'avg');
        if (!reducer) {
          reducer = functions[0];
        }
        setReduce({
          name: reducer.value,
          type: QueryEditorPropertyType.Function,
        });
      }

      if (reduce) {
        onChange({
          type: QueryEditorExpressionType.Reduce,
          property,
          reduce,
          parameters,
        });
      }
    },
    [setField, value, functions, reduce, parameters, onChange]
  );

  const onChangeReduce = useCallback(
    (property: QueryEditorProperty) => {
      setReduce(property);
      onChange({
        type: QueryEditorExpressionType.Reduce,
        property,
        reduce: property,
        parameters,
      });
    },
    [setReduce, parameters, onChange]
  );

  const onChangeParameter = useCallback(
    (expression: QueryEditorFunctionParameterExpression[]) => {
      setParameters(expression);
      if (reduce && field) {
        onChange({
          type: QueryEditorExpressionType.Reduce,
          property: field,
          reduce,
          parameters: expression,
        });
      }
    },
    [setParameters, reduce, field, onChange]
  );

  const reduceParameters: QueryEditorFunctionParameter[] = getParameters(reduce, props.functions);

  return (
    <div className={styles.container}>
      <QueryEditorField
        value={reduce}
        fields={props.functions}
        onChange={onChangeReduce}
        placeholder="Choose aggregation function..."
      />
      {reduceParameters.length > 0 && (
        <div className={styles.params}>
          {reduceParameters.map((param) => {
            return (
              <QueryEditorFunctionParameterSection
                key={param.name}
                name={param.name}
                value={props.value?.parameters?.find((p) => p.name === param.name)?.value}
                description={param.description}
                fieldType={param.type}
                onChange={(val) => onChangeParameter([val])}
              />
            );
          })}
        </div>
      )}
      {applyOnField && (
        <>
          <InlineFormLabel width={2} className="query-keyword">
            {props.label ?? 'of'}
          </InlineFormLabel>
          <QueryEditorField
            value={field}
            fields={props.fields}
            templateVariableOptions={props.templateVariableOptions}
            onChange={onChangeField}
            placeholder="Choose column..."
          />
        </>
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-direction: row;
  `,
  params: css`
    margin-right: 4px;
  `,
});

const getParameters = (
  reduce: QueryEditorProperty | undefined,
  functions: QueryEditorFunctionDefinition[]
): QueryEditorFunctionParameter[] => {
  if (!reduce) {
    return [];
  }
  const func = functions.find((func) => func.value === reduce.name);

  return func?.parameters || [];
};

const useApplyOnField = (
  property: QueryEditorProperty | undefined,
  functions: QueryEditorFunctionDefinition[]
): boolean => {
  return useMemo(() => {
    if (!property) {
      return functions[0]?.applyOnField ?? true;
    }
    const func = functions.find((f) => f.value === property.name);
    return func?.applyOnField ?? true;
  }, [functions, property]);
};
