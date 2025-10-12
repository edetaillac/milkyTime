"use client"

import { HydrationWrapper } from "../src/components/HydrationWrapper"
import {
  sideLabels,
  sideColors,
  sideBadgeVariant,
  formatTimeInterval,
  formatYAxisInterval,
  getEvolutionYDomain,
} from "../src/lib"
import { FoodTrackerProvider, useFoodTrackerContext } from "../src/hooks/useFoodTrackerContext"
import { AddFeedingPanel } from "../src/components/AddFeedingPanel"
import { TodayAndSmartCards } from "../src/components/TodayAndSmartCards"
import { RecentFeedingsTable } from "../src/components/RecentFeedingsTable"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PredictionInfoDialog } from "../src/components/PredictionInfoDialog"
import { BedtimeInfoDialog } from "../src/components/BedtimeInfoDialog"
import { MonthlyRecords } from "../src/components/MonthlyRecords"
import { AppHeader } from "../src/components/AppHeader"
import { FeedingTimeline } from "../src/components/FeedingTimeline"
import { FeedingTimeline24h } from "../src/components/FeedingTimeline24h"
import { FeedingTimeline3d } from "../src/components/FeedingTimeline3d"
import { FeedingTimeline7d } from "../src/components/FeedingTimeline7d"
import { IntervalStatisticsByDays } from "../src/components/IntervalStatisticsByDays"
import { IntervalStatisticsByWeeks } from "../src/components/IntervalStatisticsByWeeks"
import { EvolutionChart } from "../src/components/EvolutionChart"
import { DeleteConfirmDialog } from "../src/components/DeleteConfirmDialog"
import { Activity, Star, Trophy } from "lucide-react"
import { LoginForm } from "@/components/login-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// Tooltip UI non utilisé ici

// ===========================
// Composant principal
// ===========================
export default function FoodTracker() {
  return (
    <FoodTrackerProvider>
      <FoodTrackerView />
    </FoodTrackerProvider>
  )
}

function FoodTrackerView() {
  const {
    isAuthenticated,
    authError,
    handleLogin,
    handleLogout,
    loading,
    submitting,
    currentUser,
    calculateBabyAgeWeeks,
    formatBabyAge,
    isDarkMode,
    setIsDarkMode,
    showPredictionInfo,
    setShowPredictionInfo,
    showRecordModal,
    setShowRecordModal,
    deleteConfirmId,
    setDeleteConfirmId,
    logsWithIntervals,
    totalLogsCount,
    dailyStats7d,
    dailyStats30d,
    weeklyMedianData,
    last7DaysData,
    records,
    suggestedSide,
    error,
    success,
    recordBroken,
    editingId,
    editingDate,
    editingTime,
    setEditingDate,
    setEditingTime,
    addLog,
    startEditing,
    cancelEditing,
    saveEdit,
    deleteLog,
    confirmDelete,
    formatTimestamp,
    getTooltipContentStyle,
    getRecordIndicator,
    bedtimePrediction,
    showBedtimeInfo,
    setShowBedtimeInfo,
    t,
  } = useFoodTrackerContext()

  if (!isAuthenticated) return <LoginForm onLogin={handleLogin} error={authError ?? undefined} />
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 data-testid="page-title" className="text-2xl font-bold flex items-center justify-center gap-2 mb-4">
              <img src="/logo_app.png" alt="Logo" className="h-8 w-8" />
              {t('pageTitle')}
            </h1>
            <p>Loading feeding tracking...</p>
          </div>
        </div>
      </div>
    )
  }
  return (
    <HydrationWrapper>
    <div
      className={`min-h-screen ${
        isDarkMode 
          ? "dark bg-[#1a1a1a] text-gray-100" 
          : "bg-white text-gray-900"
      }`}
    >
      <div className="container mx-auto p-6 space-y-6">
      {/* Modal record */}
      <Dialog open={showRecordModal && recordBroken !== null} onOpenChange={setShowRecordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Trophy className="h-16 w-16 text-yellow-500 animate-bounce" />
                <Star className="h-6 w-6 text-yellow-400 absolute -top-1 -right-1 animate-spin" />
              </div>
            </div>
            <DialogTitle className="text-2xl font-bold text-center">🎉 NEW RECORD ! 🎉</DialogTitle>
            <DialogDescription className="text-center space-y-2">
              {recordBroken ? (
                <>
                  <div className="text-lg font-semibold text-primary">
                    {recordBroken.beatenRecords.length > 1 ? (
                      <>
                        {recordBroken.type === "day" ? "Day ☀️ records" : "Night 🌙 records"}{" "}
                        {recordBroken.beatenRecords
                          .map((r) => (r === "gold" ? "🥇" : r === "silver" ? "🥈" : "🥉"))
                          .join(" ")}{" "}
                        broken!
                      </>
                    ) : (
                      <>
                        {recordBroken.type === "day" ? "Day ☀️ record" : "Night 🌙 record"}{" "}
                        {recordBroken.recordLevel === "gold"
                          ? "🥇"
                          : recordBroken.recordLevel === "silver"
                            ? "🥈"
                            : "🥉"}{" "}
                        broken!
                      </>
                    )}
                  </div>
                  <div className="bg-gradient-to-r from-yellow-100 to-orange-100 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-orange-600 mb-2">
                      {formatTimeInterval(recordBroken.newRecord)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {recordBroken.oldRecord > 0 ? (
                        <>
                          Old record : {formatTimeInterval(recordBroken.oldRecord)}
                          <br />
                          Improvement : +{formatTimeInterval(recordBroken.improvement)}
                        </>
                      ) : (
                        "First record established!"
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-muted-foreground">New Record loading...</div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setShowRecordModal(false)}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Fantastic !
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal delete confirm */}
      <DeleteConfirmDialog
        open={deleteConfirmId !== null}
        submitting={submitting}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && confirmDelete(deleteConfirmId)}
      />

      {/* Header */}
      <AppHeader
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        currentUser={currentUser}
        onLogout={handleLogout}
        formatBabyAge={formatBabyAge}
        title={t('pageTitle')}
      />

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Add a feeding */}
      <AddFeedingPanel
        isDarkMode={isDarkMode}
        submitting={submitting}
        suggestedSide={suggestedSide}
        onAddFeeding={addLog}
      />

      {/* Cartes Aujourd'hui + Smart */}
      <TodayAndSmartCards />

      {/* Interval Evolution */}
        <FeedingTimeline isDarkMode={isDarkMode}>
              <div className="mt-1">
                <Tabs defaultValue="24h" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="24h">24h</TabsTrigger>
                    <TabsTrigger value="3d">3 days</TabsTrigger>
                    <TabsTrigger value="7d">7 days</TabsTrigger>
                  </TabsList>

                  <TabsContent value="24h" className="mt-2">
                    <FeedingTimeline24h />
                  </TabsContent>

                  <TabsContent value="3d" className="mt-2">
                    <FeedingTimeline3d />
                  </TabsContent>

                  <TabsContent value="7d" className="mt-2">
                    <FeedingTimeline7d />
                  </TabsContent>
                </Tabs>
              </div>
        </FeedingTimeline>

      {/* Intervalle médian par semaine */}
      <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Interval Statistics
          </CardTitle>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "#f59e0b" }}></div>
              <span>Day</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: "#3b82f6" }}></div>
              <span>Night</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pt-0 pb-2">
          <Tabs defaultValue="this-week" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="this-week">By days</TabsTrigger>
              <TabsTrigger value="by-week">By weeks</TabsTrigger>
            </TabsList>
            
            <TabsContent value="this-week" className="mt-1">
              <IntervalStatisticsByDays
                data={last7DaysData}
                getTooltipContentStyle={getTooltipContentStyle}
                formatTimeInterval={formatTimeInterval}
                formatYAxisInterval={formatYAxisInterval}
              />
            </TabsContent>
            
            <TabsContent value="by-week" className="mt-1">
              <IntervalStatisticsByWeeks
                data={weeklyMedianData}
                getTooltipContentStyle={getTooltipContentStyle}
                formatTimeInterval={formatTimeInterval}
                formatYAxisInterval={formatYAxisInterval}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Evolution */}
      <Card className={isDarkMode ? "bg-[#2a2a2a] border-gray-700" : "bg-white border-gray-200"}>
            <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Evolution
            </CardTitle>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
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
            <Tabs defaultValue="7d" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="7d">7 days</TabsTrigger>
                <TabsTrigger value="30d">1&nbsp;month</TabsTrigger>
              </TabsList>

              {/* 7 jours */}
              <TabsContent value="7d" className="mt-1">
                <EvolutionChart
                  data={dailyStats7d}
                  sideColors={sideColors}
                  getEvolutionYDomain={getEvolutionYDomain}
                  getTooltipContentStyle={getTooltipContentStyle}
                />
              </TabsContent>


              {/* 30 jours */}
              <TabsContent value="30d" className="mt-1">
                <EvolutionChart
                  data={dailyStats30d}
                  sideColors={sideColors}
                  getEvolutionYDomain={getEvolutionYDomain}
                  getTooltipContentStyle={getTooltipContentStyle}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      {/* Records */}
      <MonthlyRecords
        isDarkMode={isDarkMode}
        records={records}
        formatTimeInterval={formatTimeInterval}
      />

      {/* Table récentes */}
      <RecentFeedingsTable
        isDarkMode={isDarkMode}
        logsWithIntervals={logsWithIntervals}
        editingId={editingId}
        editingDate={editingDate}
        editingTime={editingTime}
        startEditing={startEditing}
        cancelEditing={cancelEditing}
        saveEdit={saveEdit}
        deleteLog={deleteLog}
        formatTimestamp={formatTimestamp}
        sideLabels={sideLabels}
        sideBadgeVariant={sideBadgeVariant}
        formatTimeInterval={formatTimeInterval}
        getRecordIndicator={getRecordIndicator}
        onChangeEditingDate={setEditingDate}
        onChangeEditingTime={setEditingTime}
      />

      {/* Popup d'information sur les prédictions */}
      <PredictionInfoDialog
        open={showPredictionInfo}
        onOpenChange={setShowPredictionInfo}
        totalLogsCount={totalLogsCount}
        calculateBabyAgeWeeks={calculateBabyAgeWeeks}
      />
      <BedtimeInfoDialog
        open={showBedtimeInfo}
        onOpenChange={setShowBedtimeInfo}
        bedtimePrediction={bedtimePrediction}
        calculateBabyAgeWeeks={calculateBabyAgeWeeks}
      />
            </div>
            </div>
    </HydrationWrapper>
  )
}
