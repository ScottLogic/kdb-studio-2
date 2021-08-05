import React, { FunctionComponent, useCallback, useContext, useEffect, useReducer, useState } from 'react'
import { 
  CommandBar, 
  ConstrainMode, 
  DetailsList, 
  DetailsListLayoutMode,  
  IColumn, 
  ICommandBarItemProps,
  IContextualMenuItem,
  IDetailsListStyles,
  ITextProps,
  MessageBar,
  MessageBarType,
  SelectionMode,
  Shimmer,
  Spinner,
  SpinnerSize,
  Stack,
  Text,
  useTheme,
} from "@fluentui/react"
import { getFileTypeIconProps } from '@fluentui/react-file-type-icons';

import { resultsWindow, stackTokens } from '../style'
import { ResultsProcessor } from '../results/processor'
import { ipcRenderer } from 'electron'
import Exporter, { ExportFormat } from '../results/exporter';
import Result from '../types/results';

enum ResultsView {
  Table,
  Raw
}
interface ResultsWindowProps {
  results: Result | undefined;
  isLoading: boolean;
  onExecuteQuery: (query: string) => void;
}

const ResultsWindow:FunctionComponent<ResultsWindowProps> = ({ results, isLoading, onExecuteQuery }) => {

  const [currentResults,setCurrentResults] = useState<any>(null)
  const [currentScript, setCurrentScript] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [columns, setColumns] = useState<IColumn[]>([])
  const [rows, setRows] = useState<Array<{}|string>>([])
  const [start, setStart] = useState(0)
  const [currentView, setCurrentView] = useState(ResultsView.Raw)
  const [viewOptions, setViewOptions] = useState<ICommandBarItemProps[]>([])

  const theme = useTheme()

  useEffect(() => {

    if (results) {
      setCurrentScript(results.script)
      setError(results.error)
      setCurrentResults(results.data)
    } else {
      setCurrentScript(undefined)
      setError(undefined)
      setCurrentResults(null)
    }
    
    setStart(0)

  }, [results])

  // Format the results for display (needs extracting out)
  useEffect(() => {

    if (currentResults) {
      const processed = ResultsProcessor.process(currentResults, start)

      if (Array.isArray(processed)) {
        setCurrentView(ResultsView.Table)
        const [cols, rows] = processed as [Array<IColumn>, Array<{}>]

        setColumns(cols)
        setRows(rows)
      } else {
        setColumns([])
        setRows([])
      }
    }

  }, [currentResults, error])

  useEffect(() => {

    if (rows.length > 0) {
      setViewOptions([
        {
          key: "table",
          text: "Table",
          iconProps: { iconName: "Table" },
          checked: (currentView == ResultsView.Table),
          onClick: () => {
            setCurrentView(ResultsView.Table)
          }
        },
        {
          key: "text",
          text: "Raw",
          iconProps: { iconName: "RawSource" },
          checked: (currentView == ResultsView.Raw),
          onClick: () => {
            setCurrentView(ResultsView.Raw)
          }
        }
      ])
    } else {
      setViewOptions([])
    }

  }, [currentView, rows])

  useEffect(() => {
    if (start > 0) {
      if (results) {
        const processed = ResultsProcessor.process(currentResults, start)
  
        if (Array.isArray(processed)) {
          const [_, newRows] = processed as [Array<IColumn>, Array<{}>]
  
          setRows([...rows.slice(0, rows.length - 1), ...newRows])
        }
      }
    }
  }, [start])

  ipcRenderer.on("download-complete", (_, file) => {
    Exporter.cleanup(file)
  })
              

  const parseMoreResults = (index?: number) => {
    setTimeout(() => {
      setStart(index || 0)
    }, 100)
    
    return (<Shimmer isDataLoaded={false}></Shimmer>)
  }


  const farItems: ICommandBarItemProps[] = [
    {
      key: "refresh",
      iconProps: { iconName: "Refresh" },
      disabled: !(results && results.data),
      onClick: () => {
        onExecuteQuery(results!.script);
      }
    },
    {
      key: "excel",
      title: "Open in Excel",
      iconProps: { iconName: "ExcelLogo" },
      disabled: (!rows || rows.length == 0),
      onClick: () => {
        const file = Exporter.export(currentResults!, ExportFormat.xlsx)
        if (file) {
          ipcRenderer.send("open-file", {
            url: file
          })
        }
      },
    },
    {
      key: "export",
      text: "Export",
      title: "Export result set",
      iconProps: { iconName: "Export" },
      disabled: (!rows || rows.length == 0),
      subMenuProps: {
        onItemClick: (_, item?: IContextualMenuItem) => {
          if (item && item.key) {
            const file = Exporter.export(currentResults!,item.key as ExportFormat)
            if (file) {
              ipcRenderer.send("download", {
                url: file,
                properties: {
                  saveAs:true
                }
              })
            }
          }
        },
        items: [
          {
            key: ExportFormat.csv,
            text: "CSV (comma separated)",
            iconProps: getFileTypeIconProps({extension:"csv"})
          },
          {
            key: ExportFormat.txt,
            text: "TXT (tab separated)",
            iconProps: getFileTypeIconProps({extension:"txt"})
          },
          {
            key: ExportFormat.xml,
            text: "XML",
            iconProps: getFileTypeIconProps({extension:"xml"})
          },
          {
            key: ExportFormat.xlsx,
            text: "XLSX",
            iconProps: getFileTypeIconProps({extension:"xlsx"})
          }
        ]
      }
    }
  ]

  const gridStyles: Partial<IDetailsListStyles> = {
    root: {
      overflowX: 'scroll',
      selectors: {
        '& [role=grid]': {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'start',
          height:"100%"
        },
      },
    },
    headerWrapper: {
      flex: '0 0 auto',
    },
    contentWrapper: {
      flex: '1 1 auto',
      overflowY: 'auto',
      overflowX: 'hidden',
    },
  };

  return (
    <Stack style={{
      ...resultsWindow,
      backgroundColor: theme.palette.white
    }}>
      <CommandBar 
        items={viewOptions}
        farItems={farItems}
        style={{ flex: "0" }}/>
        <Stack tokens={stackTokens}>
        {(isLoading ) ? (
          <Spinner size={SpinnerSize.large}/>
        ) : (
          (error) ? (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={true}
              >
              <Text 
                block 
                variant={"large" as ITextProps['variant']}
                style={{color:"inherit"}}>
                Error when executing query
              </Text>
              <br/>
              <Text 
                block
                style={{color:"inherit"}}>
                Query: {currentScript}
              </Text>
              <Text 
                block
                style={{color:"inherit"}}>
                {error}
              </Text>
            </MessageBar>
          ) : (
            <>
              {(typeof currentResults === "string" || currentView == ResultsView.Raw) ? (
                <pre>{currentResults ? JSON.stringify(currentResults,null,2) : ""}</pre>
              ): (
              <DetailsList
                columns={columns}
                items={rows}
                styles={gridStyles}
                layoutMode={DetailsListLayoutMode.fixedColumns}
                constrainMode={ConstrainMode.unconstrained}
                selectionMode={SelectionMode.none}
                onRenderMissingItem={parseMoreResults}/>
              )}
            </>
          )
        )}
        </Stack>
    </Stack>
  )
}

export default ResultsWindow