import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface AddFeedingPanelProps {
  isDarkMode: boolean
  submitting: boolean
  suggestedSide: "left" | "right" | null
  onAddFeeding: (side: "left" | "right" | "bottle") => void
}

export function AddFeedingPanel({ 
  isDarkMode, 
  submitting, 
  suggestedSide, 
  onAddFeeding 
}: AddFeedingPanelProps) {
  return (
    <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xl font-semibold">
          <Plus className="h-5 w-5" />
          Add a feeding
        </CardTitle>
        <p className={`text-xs italic ${isDarkMode ? "text-gray-400" : "text-gray-400"}`}>
          The highlighted breast indicates the recommended side for balanced feeding
        </p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 py-0">
        <div className="flex flex-row flex-nowrap gap-3 sm:gap-6 items-stretch">
          {/* Breast Toggle */}
          <div className={`${isDarkMode ? "bg-gray-700" : "bg-gray-100"} rounded-2xl px-3 py-4 sm:px-4 sm:py-5 flex flex-col items-center gap-2 sm:gap-3 basis-2/3 flex-[2] min-w-0`}>
            <div className="flex gap-4 sm:gap-5 relative">
              {/* Left Breast */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  {suggestedSide === "left" && (
                    <div className="absolute inset-0 rounded-full bg-pink-300/80 animate-ping" style={{ width: '45px', height: '45px', top: '5.5px', left: '5.5px' }}></div>
                  )}
                  <div 
                    onClick={() => !submitting && onAddFeeding("left")}
                    className={`rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-semibold relative border-3 ${
                      suggestedSide === "left"
                        ? "bg-pink-500 text-white border-pink-500 shadow-lg shadow-pink-500/30"
                        : `${isDarkMode ? "bg-gray-800 border-pink-500/70 text-pink-500 hover:bg-gray-700" : "bg-white border-pink-500/70 text-pink-500"} hover:scale-105 hover:shadow-md`
                    } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={{ width: '56px', height: '56px' }}
                  >
                    <div className="flex items-baseline gap-0.5 leading-none">
                      <span className={`text-xl sm:text-2xl font-semibold ${suggestedSide === "left" ? "text-white" : "text-gray-400"}`}>L</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium opacity-90 ${suggestedSide === "left" ? "text-white" : "text-gray-400"}`} style={{ transform: 'translateY(0.5px)' }}>eft</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Right Breast */}
              <div className="flex flex-col items-center gap-1">
                <div className="relative">
                  {suggestedSide === "right" && (
                    <div className="absolute inset-0 rounded-full bg-purple-300/80 animate-ping" style={{ width: '45px', height: '45px', top: '5.5px', left: '5.5px' }}></div>
                  )}
                  <div 
                    onClick={() => !submitting && onAddFeeding("right")}
                    className={`rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center text-base sm:text-lg font-semibold relative border-3 ${
                      suggestedSide === "right"
                        ? "bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/30"
                        : `${isDarkMode ? "bg-gray-800 border-purple-500/70 text-purple-500 hover:bg-gray-700" : "bg-white border-purple-500/70 text-purple-500"} hover:scale-105 hover:shadow-md`
                    } ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    style={{ width: '56px', height: '56px' }}
                  >
                    <div className="flex items-baseline gap-0.5 leading-none">
                      <span className={`text-xl sm:text-2xl font-semibold ${suggestedSide === "right" ? "text-white" : "text-gray-400"}`}>R</span>
                      <span className={`text-[9px] sm:text-[10px] font-medium opacity-90 ${suggestedSide === "right" ? "text-white" : "text-gray-400"}`} style={{ transform: 'translateY(0.5px)' }}>ight</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-300" : "text-gray-500"}`}>Breast</span>
          </div>

          {/* Bottle Option */}
          <div 
            onClick={() => !submitting && onAddFeeding("bottle")}
            className={`${isDarkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-100 hover:bg-gray-200"} rounded-2xl px-3 py-4 sm:px-4 sm:py-5 cursor-pointer transition-all duration-300 flex flex-col items-center gap-2 hover:-translate-y-0.5 basis-1/3 flex-[1] min-w-0 ${
              submitting ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <div className={`${isDarkMode ? "bg-green-900" : "bg-green-100"} rounded-full flex items-center justify-center text-xl sm:text-2xl transition-all duration-300`} style={{ width: '44px', height: '44px' }}>
              🍼
            </div>
            <span className={`text-xs sm:text-sm ${isDarkMode ? "text-gray-300" : "text-gray-500"}`}>Bottle</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
