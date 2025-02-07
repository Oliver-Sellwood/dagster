import {
  Button,
  ButtonGroup,
  Checkbox,
  Colors,
  IconName,
  MenuItem,
  Tab,
  Tabs,
  Tag,
} from '@blueprintjs/core';
import {IconNames} from '@blueprintjs/icons';
import {Select} from '@blueprintjs/select';
import * as React from 'react';
import styled from 'styled-components/macro';

import {Box} from '../ui/Box';
import {ButtonLink} from '../ui/ButtonLink';
import {Group} from '../ui/Group';
import {Spinner} from '../ui/Spinner';

import {ExecutionStateDot} from './ExecutionStateDot';
import {LogLevel} from './LogLevel';
import {LogsFilterInput} from './LogsFilterInput';
import {LogFilter, LogFilterValue} from './LogsProvider';
import {
  extractLogCaptureStepsFromLegacySteps,
  ILogCaptureInfo,
  IRunMetadataDict,
  IStepState,
} from './RunMetadataProvider';
import {getRunFilterProviders} from './getRunFilterProviders';

export enum LogType {
  structured = 'structured',
  stdout = 'stdout',
  stderr = 'stderr',
}

interface ILogsToolbarProps {
  steps: string[];
  metadata: IRunMetadataDict;

  filter: LogFilter;
  onSetFilter: (filter: LogFilter) => void;
  logType: LogType;
  onSetLogType: (logType: LogType) => void;
  computeLogKey?: string;
  onSetComputeLogKey: (key: string) => void;
  computeLogUrl: string | null;
}

const logQueryToString = (logQuery: LogFilterValue[]) =>
  logQuery.map(({token, value}) => (token ? `${token}:${value}` : value)).join(' ');

export const LogsToolbar: React.FC<ILogsToolbarProps> = (props) => {
  const {
    steps,
    metadata,
    filter,
    onSetFilter,
    logType,
    onSetLogType,
    computeLogKey,
    onSetComputeLogKey,
    computeLogUrl,
  } = props;
  return (
    <LogsToolbarContainer>
      <ButtonGroup>
        <Button
          icon="properties"
          title="Structured event logs"
          active={logType === LogType.structured}
          onClick={() => onSetLogType(LogType.structured)}
        />
        <Button
          icon="console"
          title="Raw compute logs"
          active={logType !== LogType.structured}
          onClick={() => onSetLogType(LogType.stdout)}
        />
      </ButtonGroup>
      <LogsToolbarDivider />
      {logType === 'structured' ? (
        <StructuredLogToolbar filter={filter} onSetFilter={onSetFilter} steps={steps} />
      ) : (
        <ComputeLogToolbar
          steps={steps}
          metadata={metadata}
          logType={logType}
          onSetLogType={onSetLogType}
          computeLogKey={computeLogKey}
          onSetComputeLogKey={onSetComputeLogKey}
          computeLogUrl={computeLogUrl}
        />
      )}
    </LogsToolbarContainer>
  );
};

const resolveState = (metadata: IRunMetadataDict, logCapture: ILogCaptureInfo) => {
  // resolves the state of potentially many steps into a single state so that we can show the
  // execution dot representing the status of this log capture group (potentially at the process
  // level)
  if (logCapture.stepKeys.some((stepKey) => metadata.steps[stepKey].state === IStepState.RUNNING)) {
    return IStepState.RUNNING;
  }
  if (logCapture.stepKeys.some((stepKey) => metadata.steps[stepKey].state === IStepState.SKIPPED)) {
    return IStepState.SKIPPED;
  }
  if (
    logCapture.stepKeys.every((stepKey) => metadata.steps[stepKey].state === IStepState.SUCCEEDED)
  ) {
    return IStepState.SUCCEEDED;
  }
  return IStepState.FAILED;
};

const ComputeLogToolbar = ({
  steps,
  metadata,
  computeLogKey,
  onSetComputeLogKey,
  logType,
  onSetLogType,
  computeLogUrl,
}: {
  steps: string[];
  metadata: IRunMetadataDict;
  computeLogKey?: string;
  onSetComputeLogKey: (step: string) => void;
  logType: LogType;
  onSetLogType: (type: LogType) => void;
  computeLogUrl: string | null;
}) => {
  const logCaptureSteps =
    metadata.logCaptureSteps || extractLogCaptureStepsFromLegacySteps(Object.keys(metadata.steps));
  const isValidStepSelection = computeLogKey && logCaptureSteps[computeLogKey];
  const logKeyText = (logKey?: string) => {
    if (!logKey || !logCaptureSteps[logKey]) {
      return null;
    }
    const captureInfo = logCaptureSteps[logKey];
    if (captureInfo.stepKeys.length === 1 && logKey === captureInfo.stepKeys[0]) {
      return logKey;
    }
    if (captureInfo.pid) {
      return `pid: ${captureInfo.pid} (${captureInfo.stepKeys.length} steps)`;
    }
    return `${logKey} (${captureInfo.stepKeys.length} steps)`;
  };

  return (
    <Box
      flex={{justifyContent: 'space-between', alignItems: 'center', direction: 'row'}}
      style={{flex: 1}}
    >
      <Group direction="row" spacing={24} alignItems="center">
        <Select
          disabled={!steps.length}
          items={Object.keys(logCaptureSteps)}
          itemRenderer={(item: string, options: {handleClick: any; modifiers: any}) => (
            <MenuItem
              key={item}
              onClick={options.handleClick}
              text={logKeyText(item)}
              active={options.modifiers.active}
            />
          )}
          activeItem={computeLogKey}
          filterable={false}
          onItemSelect={(logKey) => {
            onSetComputeLogKey(logKey);
          }}
        >
          <Button
            text={logKeyText(computeLogKey) || 'Select a step...'}
            disabled={!steps.length}
            rightIcon="caret-down"
            style={{minHeight: 25}}
          />
        </Select>
        {isValidStepSelection ? (
          <Tabs selectedTabId={LogType[logType]}>
            <Tab
              id={LogType[LogType.stdout]}
              title={
                <ButtonLink
                  color={
                    logType === LogType.stdout
                      ? Colors.BLUE1
                      : {link: Colors.GRAY2, hover: Colors.BLUE1}
                  }
                  underline="never"
                  onClick={() => onSetLogType(LogType.stdout)}
                >
                  stdout
                </ButtonLink>
              }
            />
            <Tab
              id={LogType[LogType.stderr]}
              title={
                <ButtonLink
                  color={
                    logType === LogType.stderr
                      ? Colors.BLUE1
                      : {link: Colors.GRAY2, hover: Colors.BLUE1}
                  }
                  underline="never"
                  onClick={() => onSetLogType(LogType.stderr)}
                >
                  stderr
                </ButtonLink>
              }
            />
          </Tabs>
        ) : null}
      </Group>
      {isValidStepSelection ? (
        <Group direction="row" spacing={12} alignItems="center">
          {computeLogKey && logCaptureSteps[computeLogKey] ? (
            resolveState(metadata, logCaptureSteps[computeLogKey]) === IStepState.RUNNING ? (
              <Spinner purpose="body-text" />
            ) : (
              <ExecutionStateDot state={resolveState(metadata, logCaptureSteps[computeLogKey])} />
            )
          ) : null}
          {computeLogUrl ? (
            <a
              aria-label="Download link"
              className="bp3-button bp3-minimal bp3-icon-download"
              href={computeLogUrl}
              title={
                computeLogKey && logCaptureSteps[computeLogKey]?.stepKeys.length === 1
                  ? `Download ${logCaptureSteps[computeLogKey]?.stepKeys[0]} compute logs`
                  : `Download compute logs`
              }
              download
            ></a>
          ) : null}
        </Group>
      ) : null}
    </Box>
  );
};

const StructuredLogToolbar = ({
  filter,
  onSetFilter,
  steps,
}: {
  filter: LogFilter;
  onSetFilter: (filter: LogFilter) => void;
  steps: string[];
}) => {
  const [copyIcon, setCopyIcon] = React.useState<IconName>(IconNames.CLIPBOARD);
  const logQueryString = logQueryToString(filter.logQuery);
  const [queryString, setQueryString] = React.useState<string>(() => logQueryString);
  const selectedStep = filter.logQuery.find((v) => v.token === 'step')?.value || null;
  const filterText = filter.logQuery.reduce((accum, value) => accum + value.value, '');

  // Reset the query string if the filter is updated, allowing external behavior
  // (e.g. clicking a Gantt step) to set the input.
  React.useEffect(() => {
    setQueryString(logQueryString);
  }, [logQueryString]);

  const onChange = (value: string) => {
    const tokens = value.split(/\s+/);
    const logQuery = tokens.map((item) => {
      const segments = item.split(':');
      if (segments.length > 1) {
        return {token: segments[0], value: segments[1]};
      }
      return {value: segments[0]};
    });
    onSetFilter({...filter, logQuery: logQuery as LogFilterValue[]});
    setQueryString(value);
  };

  // Restore the clipboard icon after a delay.
  React.useEffect(() => {
    let token: any;
    if (copyIcon === IconNames.SAVED) {
      token = setTimeout(() => {
        setCopyIcon(IconNames.CLIPBOARD);
      }, 2000);
    }
    return () => {
      token && clearTimeout(token);
    };
  }, [copyIcon]);

  return (
    <>
      <LogsFilterInput
        value={queryString}
        suggestionProviders={getRunFilterProviders(steps)}
        onChange={onChange}
      />
      {filterText ? (
        <NonMatchCheckbox
          inline
          checked={filter.hideNonMatches}
          onChange={(event) =>
            onSetFilter({...filter, hideNonMatches: event.currentTarget.checked})
          }
        >
          Hide non-matches
        </NonMatchCheckbox>
      ) : null}
      <LogsToolbarDivider />
      <div style={{display: 'flex'}}>
        {Object.keys(LogLevel).map((level) => {
          const enabled = filter.levels[level];
          return (
            <FilterTag
              key={level}
              intent={enabled ? 'primary' : 'none'}
              interactive
              minimal={!enabled}
              onClick={() =>
                onSetFilter({
                  ...filter,
                  levels: {
                    ...filter.levels,
                    [level]: !enabled,
                  },
                })
              }
              round
            >
              {level.toLowerCase()}
            </FilterTag>
          );
        })}
      </div>
      {selectedStep && <LogsToolbarDivider />}
      <div style={{minWidth: 15, flex: 1}} />
      <div style={{marginRight: '8px'}}>
        <Button
          small
          icon={copyIcon}
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setCopyIcon(IconNames.SAVED);
          }}
          text="Copy URL"
        />
      </div>
    </>
  );
};

const LogsToolbarContainer = styled.div`
  display: flex;
  flex-direction: row;
  background: ${Colors.WHITE};
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid ${Colors.GRAY4};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.07);
  z-index: 2;
`;

const NonMatchCheckbox = styled(Checkbox)`
  &&& {
    margin: 0 4px 0 12px;
  }

  white-space: nowrap;
`;

const LogsToolbarDivider = styled.div`
  display: inline-block;
  width: 1px;
  height: 30px;
  margin: 0 8px;
  border-right: 1px solid ${Colors.LIGHT_GRAY3};
`;

const FilterTag = styled(Tag)`
  margin-right: 8px;
  text-transform: capitalize;
  opacity: ${({minimal}) => (minimal ? '0.5' : '1')};
`;
