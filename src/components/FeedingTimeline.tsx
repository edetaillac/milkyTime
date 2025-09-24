import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlignHorizontalSpaceAround } from "lucide-react"
import type React from "react"

interface FeedingTimelineProps {
  isDarkMode: boolean
  children: React.ReactNode
}

export function FeedingTimeline({ isDarkMode, children }: FeedingTimelineProps) {
  return (
    <Card className={`gap-2 ${isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <AlignHorizontalSpaceAround className="h-5 w-5" />
          Feeding Timeline
        </CardTitle>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-pink-500 rounded"></div>
            <span>Left breast</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Right breast</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Bottle</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-0 pb-2">
        {children}
      </CardContent>
    </Card>
  )
}


