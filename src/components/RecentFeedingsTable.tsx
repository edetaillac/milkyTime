import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Check, Edit3, Trash2, X } from "lucide-react"
import { Input } from "@/components/ui/input"

import { type FoodLogWithInterval } from "../lib/types"

interface RecentFeedingsTableProps {
  isDarkMode: boolean
  logsWithIntervals: FoodLogWithInterval[]
  editingId: string | null
  editingDate: string
  editingTime: string
  startEditing: (log: FoodLogWithInterval) => void
  cancelEditing: () => void
  saveEdit: (id: string) => void
  deleteLog: (id: string) => void
  formatTimestamp: (iso: string) => string
  sideLabels: { left: string; right: string; bottle: string }
  sideBadgeVariant: (side: string) => any
  formatTimeInterval: (minutes: number) => string
  getRecordIndicator: (log: FoodLogWithInterval) => string | null
  onChangeEditingDate: (value: string) => void
  onChangeEditingTime: (value: string) => void
}

export function RecentFeedingsTable(props: RecentFeedingsTableProps) {
  const {
    isDarkMode,
    logsWithIntervals,
    editingId,
    editingDate,
    editingTime,
    startEditing,
    cancelEditing,
    saveEdit,
    deleteLog,
    formatTimestamp,
    sideLabels,
    sideBadgeVariant,
    formatTimeInterval,
    getRecordIndicator,
    onChangeEditingDate,
    onChangeEditingTime,
  } = props

  return (
    <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
      <CardHeader className="pb-3">
        <CardTitle>Recent feedings (20)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Gap</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsWithIntervals.map((log) => {
              const feedingTime = new Date(log.timestamp)
              const hour = feedingTime.getHours()
              const isNightFeeding = hour >= 22 || hour < 7
              const dayNightBg = isNightFeeding
                ? (isDarkMode ? "bg-blue-950/20" : "bg-blue-50/50")
                : (isDarkMode ? "bg-amber-950/20" : "bg-amber-50/50")

              return (
                <TableRow key={log.id} className={`group hover:bg-muted/50 ${dayNightBg}`}>
                  <TableCell className="font-medium">
                    {editingId === log.id ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="date"
                            value={editingDate}
                            onChange={(e) => onChangeEditingDate(e.target.value)}
                            className="w-36 h-8"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Input
                            type="time"
                            value={editingTime}
                            onChange={(e) => onChangeEditingTime(e.target.value)}
                            className="w-24 h-8"
                          />
                        </div>
                        <div className="flex items-center gap-1 mt-2 sm:mt-0">
                          <Button onClick={() => saveEdit(log.id)} variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600" title="Save">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button onClick={cancelEditing} variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600" title="Cancel">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{formatTimestamp(log.timestamp)}</span>
                        <Button onClick={() => startEditing(log)} variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600" title="Edit date and time">
                          <Edit3 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.side === "bottle" ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        {sideLabels[log.side]}
                      </span>
                    ) : (
                      <Badge variant={sideBadgeVariant(log.side)}>{sideLabels[log.side]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.intervalMinutes ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {formatTimeInterval(log.intervalMinutes)}
                        </Badge>
                        {(() => {
                          const ind = getRecordIndicator(log)
                          return ind ? (
                            <span className="text-lg" title={`${ind.includes("🌙") ? "Night" : "Day"} record of the month`}>
                              {ind}
                            </span>
                          ) : null
                        })()}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId !== log.id && (
                      <Button onClick={() => deleteLog(log.id)} variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600" title="Delete this feeding">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {logsWithIntervals.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No feedings recorded
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
