/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as clientWelcome } from './client-welcome.tsx'
import { template as assetReadyForReview } from './asset-ready-for-review.tsx'
import { template as assetFeedbackReceived } from './asset-feedback-received.tsx'
import { template as assetApproved } from './asset-approved.tsx'
import { template as newProspectReceived } from './new-prospect-received.tsx'
import { template as clientTaskCompleted } from './client-task-completed.tsx'
import { template as discoveryAnalysisReady } from './discovery-analysis-ready.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'client-welcome': clientWelcome,
  'asset-ready-for-review': assetReadyForReview,
  'asset-feedback-received': assetFeedbackReceived,
  'asset-approved': assetApproved,
  'new-prospect-received': newProspectReceived,
  'client-task-completed': clientTaskCompleted,
  'discovery-analysis-ready': discoveryAnalysisReady,
}
