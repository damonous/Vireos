import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, ChevronRight, ChevronLeft, Sparkles, Upload, ClipboardList, Globe, GripVertical, Trash2, Plus, ToggleLeft, ToggleRight, Info, DollarSign, X, Facebook, Instagram, ThumbsUp, MessageCircle, Share2, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

const steps = [
  { number: 1, label: 'Campaign' },
  { number: 2, label: 'Creative' },
  { number: 3, label: 'Lead Capture' },
  { number: 4, label: 'Follow-up' },
  { number: 5, label: 'Budget' },
  { number: 6, label: 'Targeting' },
  { number: 7, label: 'Placement' },
  { number: 8, label: 'Preview' },
  { number: 9, label: 'Submit' },
];

const adImages = [
  { id: 1, url: 'https://images.unsplash.com/photo-1758686254493-7b3e49a8f325?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGRlcmx5JTIwY291cGxlJTIwcmV0aXJlbWVudCUyMHNtaWxpbmd8ZW58MXx8fHwxNzczMDI1NjE0fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', alt: 'Elderly couple smiling' },
  { id: 2, url: 'https://images.unsplash.com/photo-1565688527174-775059ac429c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5hbmNpYWwlMjBhZHZpc29yJTIwbWVldGluZyUyMGNvbnN1bHRhdGlvbnxlbnwxfHx8fDE3NzMwMjU2MTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', alt: 'Financial advisor meeting' },
  { id: 3, url: 'https://images.unsplash.com/photo-1758523671819-06a0f1941520?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoYXBweSUyMGZhbWlseSUyMGhvbWUlMjBwbGFubmluZ3xlbnwxfHx8fDE3NzMwMjU2MTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', alt: 'Happy family at home' },
  { id: 4, url: 'https://images.unsplash.com/photo-1763309349299-7053db0ecf52?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFjaCUyMHJldGlyZW1lbnQlMjBzdW5zZXQlMjByZWxheGluZ3xlbnwxfHx8fDE3NzMwMjU2MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', alt: 'Beach retirement sunset' },
  { id: 5, url: 'https://images.unsplash.com/photo-1758518725921-1eb74ed293be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBvZmZpY2UlMjBjb25zdWx0YXRpb24lMjBidXNpbmVzc3xlbnwxfHx8fDE3NzMwMjU2MTZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', alt: 'Professional office consultation' },
  { id: 6, url: 'https://images.unsplash.com/photo-1768839720586-71b7ff8b5c59?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYXZpbmdzJTIwcGlnZ3klMjBiYW5rJTIwZmluYW5jaWFsJTIwcGxhbm5pbmd8ZW58MXx8fHwxNzczMDI1NjE3fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral', alt: 'Savings and financial planning' },
];

export default function FacebookAdWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // Campaign Setup
  const [campaignName, setCampaignName] = useState('');
  const [campaignObjective, setCampaignObjective] = useState<'lead-generation' | 'awareness' | 'traffic'>('lead-generation');

  // Ad Creative
  const [adTitle, setAdTitle] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [ctaButton, setCtaButton] = useState('Learn More');
  const [selectedImages, setSelectedImages] = useState<number[]>([1, 2, 3]);

  // Lead Capture
  const [leadCaptureMethod, setLeadCaptureMethod] = useState<'facebook-form' | 'landing-page'>('facebook-form');
  const [formFields, setFormFields] = useState([
    { id: 1, name: 'First Name', type: 'text', required: true },
    { id: 2, name: 'Last Name', type: 'text', required: true },
    { id: 3, name: 'Email Address', type: 'email', required: true },
    { id: 4, name: 'Phone Number', type: 'phone', required: false },
  ]);
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [thankYouHeadline, setThankYouHeadline] = useState("Thanks, you're all set!");
  const [thankYouDescription, setThankYouDescription] = useState("We'll be in touch shortly. You can also visit our website for more information.");
  const [thankYouLink, setThankYouLink] = useState('');
  const [thankYouCta, setThankYouCta] = useState('View Website');

  // Lead Follow-up
  const [autoAddToPipeline, setAutoAddToPipeline] = useState(true);
  const [emailSequence, setEmailSequence] = useState('Welcome to Pinnacle Financial (5 steps)');

  // Budget & Schedule
  const [dailyBudget, setDailyBudget] = useState('5');
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 31);
    return future.toISOString().split('T')[0];
  });
  const [runContinuously, setRunContinuously] = useState(false);

  // Audience Targeting
  const [audienceType, setAudienceType] = useState<'advantage' | 'manual'>('advantage');
  const [locations, setLocations] = useState<string[]>(['United States']);
  const [newLocation, setNewLocation] = useState('');
  const [ageMin, setAgeMin] = useState('45');
  const [ageMax, setAgeMax] = useState('65+');
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');
  const [interests, setInterests] = useState<string[]>(['Retirement Planning', 'Financial Advisory', 'Investment']);
  const [newInterest, setNewInterest] = useState('');

  const addLocation = () => {
    if (newLocation.trim() && !locations.includes(newLocation.trim())) {
      setLocations([...locations, newLocation.trim()]);
      setNewLocation('');
    }
  };

  const removeLocation = (location: string) => {
    setLocations(locations.filter(l => l !== location));
  };

  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  // Placement
  const [platformFacebook, setPlatformFacebook] = useState(true);
  const [platformInstagram, setPlatformInstagram] = useState(false);
  const [facebookFeed, setFacebookFeed] = useState(true);
  const [facebookStories, setFacebookStories] = useState(false);
  const [facebookReels, setFacebookReels] = useState(false);
  const [facebookRightColumn, setFacebookRightColumn] = useState(false);
  const [instagramFeed, setInstagramFeed] = useState(false);
  const [instagramStories, setInstagramStories] = useState(false);
  const [instagramReels, setInstagramReels] = useState(false);

  // Ad Preview
  const [previewTab, setPreviewTab] = useState<'desktop' | 'mobile' | 'story'>('desktop');

  const calculateBudgetStats = () => {
    const daily = parseFloat(dailyBudget) || 0;
    const maxDaily = daily * 1.25;
    const maxWeekly = daily * 4;
    return { daily, maxDaily, maxWeekly };
  };

  const calculateTotalSpend = () => {
    if (runContinuously) return null;
    const daily = parseFloat(dailyBudget) || 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return daily * days;
  };

  const toggleFieldRequired = (fieldId: number) => {
    setFormFields(prev =>
      prev.map(field =>
        field.id === fieldId ? { ...field, required: !field.required } : field
      )
    );
  };

  const deleteField = (fieldId: number) => {
    setFormFields(prev => prev.filter(field => field.id !== fieldId));
  };

  const getFieldTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: 'bg-blue-100 text-blue-700',
      email: 'bg-purple-100 text-purple-700',
      phone: 'bg-green-100 text-green-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
      navigate('/facebook');
    }
  };

  const handleNext = () => {
    // Mark current step as completed
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    // Move to next step (for now, just increment)
    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create Facebook Ad Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">Complete all steps to launch your campaign</p>
      </div>

      {/* Horizontal Stepper */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.number);
              const isCurrent = currentStep === step.number;
              const isUpcoming = step.number > currentStep;

              return (
                <div key={step.number} className="flex items-center flex-1">
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                        isCompleted
                          ? 'bg-[#0EA5E9] text-white'
                          : isCurrent
                          ? 'bg-[#0EA5E9] text-white'
                          : 'bg-white border-2 border-gray-300 text-gray-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        step.number
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium whitespace-nowrap ${
                        isCurrent
                          ? 'text-[#0EA5E9] font-semibold'
                          : isCompleted
                          ? 'text-gray-700'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connecting Line */}
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 transition-all ${
                        completedSteps.includes(step.number)
                          ? 'bg-[#0EA5E9]'
                          : 'bg-gray-300'
                      }`}
                    ></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {/* STEP 1: Campaign Setup */}
          {currentStep === 1 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Campaign Setup</h2>
              <p className="text-sm text-gray-600 mb-8">Name your campaign and choose an objective</p>

              {/* Campaign Name */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Retirement Planning Free Consultation"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Campaign Objective */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Campaign Objective
                </label>
                <div className="space-y-3">
                  {/* Lead Generation */}
                  <div
                    onClick={() => setCampaignObjective('lead-generation')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      campaignObjective === 'lead-generation'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        campaignObjective === 'lead-generation'
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                          : 'border-gray-300'
                      }`}>
                        {campaignObjective === 'lead-generation' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#1E3A5F]">Lead Generation</span>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                            recommended
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Collect leads directly from your ad
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Awareness */}
                  <div
                    onClick={() => setCampaignObjective('awareness')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      campaignObjective === 'awareness'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        campaignObjective === 'awareness'
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                          : 'border-gray-300'
                      }`}>
                        {campaignObjective === 'awareness' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-[#1E3A5F]">Awareness</span>
                        <p className="text-sm text-gray-600 mt-1">
                          Increase brand visibility in your target market
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Traffic */}
                  <div
                    onClick={() => setCampaignObjective('traffic')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      campaignObjective === 'traffic'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        campaignObjective === 'traffic'
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                          : 'border-gray-300'
                      }`}>
                        {campaignObjective === 'traffic' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-[#1E3A5F]">Traffic</span>
                        <p className="text-sm text-gray-600 mt-1">
                          Drive visitors to your website or landing page
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 2: Ad Creative */}
          {currentStep === 2 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-[#1E3A5F]">Ad Creative</h2>
                <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate with AI
                </Button>
              </div>
              <p className="text-sm text-gray-600 mb-8">Create your ad content — or let AI do it for you</p>

              {/* Title */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Portfolio of $500K+"
                  value={adTitle}
                  onChange={(e) => setAdTitle(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Primary Text */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Text
                </label>
                <textarea
                  rows={4}
                  placeholder="The main body text of your ad..."
                  value={primaryText}
                  onChange={(e) => setPrimaryText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                />
              </div>

              {/* Headline */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Headline
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Thinking About Retirement?"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <Input
                  type="text"
                  placeholder="e.g., Click Here To Download Your FREE Guide!"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Call to Action */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Call to Action
                </label>
                <select
                  value={ctaButton}
                  onChange={(e) => setCtaButton(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                >
                  <option value="Learn More">Learn More</option>
                  <option value="Sign Up">Sign Up</option>
                  <option value="Download">Download</option>
                  <option value="Get Quote">Get Quote</option>
                  <option value="Book Now">Book Now</option>
                  <option value="Contact Us">Contact Us</option>
                  <option value="Apply Now">Apply Now</option>
                </select>
              </div>

              {/* Ad Images Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Ad Images
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Select images for your ad
                </p>

                {/* Image Grid */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {adImages.map((image) => (
                    <div
                      key={image.id}
                      onClick={() => {
                        setSelectedImages(prev =>
                          prev.includes(image.id)
                            ? prev.filter(id => id !== image.id)
                            : [...prev, image.id]
                        );
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedImages.includes(image.id)
                          ? 'border-[#0EA5E9] ring-2 ring-[#0EA5E9]/20'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <ImageWithFallback
                        src={image.url}
                        alt={image.alt}
                        className="w-full h-full object-cover"
                      />
                      {/* Checkbox Overlay */}
                      <div className="absolute top-2 right-2">
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                            selectedImages.includes(image.id)
                              ? 'bg-[#0EA5E9]'
                              : 'bg-white border border-gray-300'
                          }`}
                        >
                          {selectedImages.includes(image.id) && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Selected Count and Upload Button */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Selected: <span className="font-medium text-[#1E3A5F]">{selectedImages.length} of 6</span>
                  </p>
                  <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Custom Image
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 3: Lead Capture */}
          {currentStep === 3 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Lead Capture</h2>
              <p className="text-sm text-gray-600 mb-8">How will you capture leads from this ad?</p>

              {/* Lead Capture Method Options */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Facebook Lead Form */}
                <div
                  onClick={() => setLeadCaptureMethod('facebook-form')}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    leadCaptureMethod === 'facebook-form'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      leadCaptureMethod === 'facebook-form'
                        ? 'bg-[#0EA5E9]'
                        : 'bg-gray-100'
                    }`}>
                      <ClipboardList className={`w-5 h-5 ${
                        leadCaptureMethod === 'facebook-form' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-[#1E3A5F] mb-1">Facebook Lead Form</div>
                      <p className="text-xs text-gray-600">
                        Collect leads directly within Facebook. Users fill out a form without leaving the platform.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Landing Page */}
                <div
                  onClick={() => setLeadCaptureMethod('landing-page')}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    leadCaptureMethod === 'landing-page'
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      leadCaptureMethod === 'landing-page'
                        ? 'bg-[#0EA5E9]'
                        : 'bg-gray-100'
                    }`}>
                      <Globe className={`w-5 h-5 ${
                        leadCaptureMethod === 'landing-page' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium text-[#1E3A5F]">Landing Page</div>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                          Phase 2
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Send users to your website landing page.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Facebook Form Builder (conditionally rendered) */}
              {leadCaptureMethod === 'facebook-form' && (
                <div className="space-y-6">
                  {/* Form Fields */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-gray-700">Form Fields</label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Field
                      </Button>
                    </div>

                    {/* Form Fields List */}
                    <div className="space-y-2">
                      {formFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          {/* Drag Handle */}
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0" />

                          {/* Field Name */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-[#1E3A5F]">{field.name}</span>
                          </div>

                          {/* Field Type Badge */}
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getFieldTypeBadge(field.type)}`}>
                            {field.type}
                          </span>

                          {/* Required Toggle */}
                          <button
                            onClick={() => toggleFieldRequired(field.id)}
                            className="flex items-center gap-1 text-xs font-medium transition-colors"
                          >
                            {field.required ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-[#0EA5E9]" />
                                <span className="text-[#0EA5E9]">Required</span>
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-500">Optional</span>
                              </>
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => deleteField(field.id)}
                            className="p-1 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Privacy Policy */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Privacy Policy URL
                    </label>
                    <Input
                      type="text"
                      placeholder="https://yourfirm.com/privacy"
                      value={privacyPolicyUrl}
                      onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">Required by Facebook for lead form ads</p>
                  </div>

                  {/* Thank You Message */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Thank You Message</h3>
                    
                    <div className="space-y-4">
                      {/* Headline */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Headline
                        </label>
                        <Input
                          type="text"
                          value={thankYouHeadline}
                          onChange={(e) => setThankYouHeadline(e.target.value)}
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Description
                        </label>
                        <textarea
                          rows={3}
                          value={thankYouDescription}
                          onChange={(e) => setThankYouDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                        />
                      </div>

                      {/* Link */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Link (optional)
                        </label>
                        <Input
                          type="text"
                          placeholder="https://yourfirm.com"
                          value={thankYouLink}
                          onChange={(e) => setThankYouLink(e.target.value)}
                        />
                      </div>

                      {/* CTA Button */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          CTA Button
                        </label>
                        <select
                          value={thankYouCta}
                          onChange={(e) => setThankYouCta(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                        >
                          <option value="View Website">View Website</option>
                          <option value="Download">Download</option>
                          <option value="Call Now">Call Now</option>
                          <option value="No Button">No Button</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STEP 4: Lead Follow-up */}
          {currentStep === 4 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Lead Follow-up</h2>
              <p className="text-sm text-gray-600 mb-8">What happens after someone submits the form?</p>

              {/* Auto-add to Lead Pipeline Toggle */}
              <div className="mb-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-[#1E3A5F] mb-1">Auto-add to Lead Pipeline</div>
                    <p className="text-sm text-gray-600">
                      New leads appear in Lead Management as 'New Lead' status
                    </p>
                  </div>
                  <button
                    onClick={() => setAutoAddToPipeline(!autoAddToPipeline)}
                    className="ml-4 flex-shrink-0"
                  >
                    {autoAddToPipeline ? (
                      <ToggleRight className="w-10 h-10 text-[#0EA5E9]" />
                    ) : (
                      <ToggleLeft className="w-10 h-10 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Email Sequence */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enroll in Email Sequence
                </label>
                <select
                  value={emailSequence}
                  onChange={(e) => setEmailSequence(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                >
                  <option value="Welcome to Pinnacle Financial (5 steps)">Welcome to Pinnacle Financial (5 steps)</option>
                  <option value="Tax Season Tips (4 steps)">Tax Season Tips (4 steps)</option>
                  <option value="Retirement Planning Series (6 steps)">Retirement Planning Series (6 steps)</option>
                  <option value="None">None</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  Leads automatically receive this sequence after form submission
                </p>
              </div>

              {/* Coming Soon Callout */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">
                    <span className="font-medium">Coming soon:</span> SMS follow-up sequences for multi-channel automated nurturing.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* STEP 5: Budget & Schedule */}
          {currentStep === 5 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Budget & Schedule</h2>
              <p className="text-sm text-gray-600 mb-8">Set your daily budget and campaign duration</p>

              {/* Daily Budget */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Budget
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center flex-1 border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0EA5E9] focus-within:border-transparent">
                    <span className="px-3 py-2 bg-gray-50 text-gray-700 font-medium border-r border-gray-300">
                      $
                    </span>
                    <input
                      type="number"
                      value={dailyBudget}
                      onChange={(e) => setDailyBudget(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm focus:outline-none"
                      min="1"
                      step="1"
                    />
                    <span className="px-3 py-2 bg-gray-50 text-gray-700 font-medium border-l border-gray-300">
                      USD
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Average ${calculateBudgetStats().daily.toFixed(0)}/day. Max daily: ${calculateBudgetStats().maxDaily.toFixed(2)}. Max weekly: ${calculateBudgetStats().maxWeekly.toFixed(0)}.
                </p>
              </div>

              {/* Campaign Duration */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Campaign Duration</h3>
                
                <div className="space-y-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={runContinuously}
                      className="w-full"
                    />
                  </div>

                  {/* Run Continuously Checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="runContinuously"
                      checked={runContinuously}
                      onChange={(e) => setRunContinuously(e.target.checked)}
                      className="w-4 h-4 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                    />
                    <label htmlFor="runContinuously" className="text-sm text-gray-700 cursor-pointer">
                      Run continuously until I pause
                    </label>
                  </div>

                  {/* Estimated Total Spend */}
                  {!runContinuously && calculateTotalSpend() !== null && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700">
                        Estimated total spend: <span className="text-[#0EA5E9]">${calculateTotalSpend()!.toFixed(0)}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* STEP 6: Audience Targeting */}
          {currentStep === 6 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Audience Targeting</h2>
              <p className="text-sm text-gray-600 mb-8">Who should see your ad?</p>

              {/* Audience Type Radio Cards */}
              <div className="mb-8">
                <div className="grid grid-cols-2 gap-4">
                  {/* Advantage Audience */}
                  <div
                    onClick={() => setAudienceType('advantage')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      audienceType === 'advantage'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        audienceType === 'advantage'
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                          : 'border-gray-300'
                      }`}>
                        {audienceType === 'advantage' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[#1E3A5F] mb-1">Advantage Audience</div>
                        <p className="text-xs text-gray-600">
                          Let Meta AI find the best audience
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manual Audience */}
                  <div
                    onClick={() => setAudienceType('manual')}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      audienceType === 'manual'
                        ? 'border-[#0EA5E9] bg-[#0EA5E9]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        audienceType === 'manual'
                          ? 'border-[#0EA5E9] bg-[#0EA5E9]'
                          : 'border-gray-300'
                      }`}>
                        {audienceType === 'manual' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-[#1E3A5F] mb-1">Manual Audience</div>
                        <p className="text-xs text-gray-600">
                          You control location, age, gender & interests
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Audience Details (always visible) */}
              <div className="space-y-6">
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {locations.map(location => (
                      <span
                        key={location}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 rounded-md text-sm font-medium text-[#0EA5E9]"
                      >
                        {location}
                        <button
                          onClick={() => removeLocation(location)}
                          className="hover:bg-[#0EA5E9]/20 rounded-sm p-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Add location..."
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addLocation}
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Age Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Age Range
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="text"
                      placeholder="Min"
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-gray-500 font-medium">to</span>
                    <Input
                      type="text"
                      placeholder="Max"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Gender
                  </label>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="all"
                        checked={gender === 'all'}
                        onChange={(e) => setGender(e.target.value as 'all' | 'male' | 'female')}
                        className="w-4 h-4 text-[#0EA5E9] border-gray-300 focus:ring-[#0EA5E9]"
                      />
                      <span className="text-sm text-gray-700">All</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={gender === 'male'}
                        onChange={(e) => setGender(e.target.value as 'all' | 'male' | 'female')}
                        className="w-4 h-4 text-[#0EA5E9] border-gray-300 focus:ring-[#0EA5E9]"
                      />
                      <span className="text-sm text-gray-700">Male</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={gender === 'female'}
                        onChange={(e) => setGender(e.target.value as 'all' | 'male' | 'female')}
                        className="w-4 h-4 text-[#0EA5E9] border-gray-300 focus:ring-[#0EA5E9]"
                      />
                      <span className="text-sm text-gray-700">Female</span>
                    </label>
                  </div>
                </div>

                {/* Interests (only for Manual) */}
                {audienceType === 'manual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Interests
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {interests.map(interest => (
                        <span
                          key={interest}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 rounded-md text-sm font-medium text-[#0EA5E9]"
                        >
                          {interest}
                          <button
                            onClick={() => removeInterest(interest)}
                            className="hover:bg-[#0EA5E9]/20 rounded-sm p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder="Add interest..."
                        value={newInterest}
                        onChange={(e) => setNewInterest(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addInterest}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* STEP 7: Placement */}
          {currentStep === 7 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Placement</h2>
              <p className="text-sm text-gray-600 mb-8">Where should your ad appear?</p>

              {/* Platform Selection */}
              <div className="mb-6">
                <div className="space-y-3">
                  {/* Facebook */}
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="platformFacebook"
                      checked={platformFacebook}
                      onChange={(e) => setPlatformFacebook(e.target.checked)}
                      className="w-5 h-5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                    />
                    <Facebook className="w-5 h-5 text-blue-600" />
                    <label htmlFor="platformFacebook" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Facebook
                    </label>
                  </div>

                  {/* Instagram */}
                  <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="platformInstagram"
                      checked={platformInstagram}
                      onChange={(e) => setPlatformInstagram(e.target.checked)}
                      className="w-5 h-5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                    />
                    <Instagram className="w-5 h-5 text-pink-600" />
                    <label htmlFor="platformInstagram" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Instagram
                    </label>
                  </div>
                </div>
              </div>

              {/* Facebook Placements */}
              {platformFacebook && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-[#1E3A5F] mb-3">Facebook Placements</h3>
                  <div className="space-y-3">
                    {/* Facebook Feed */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="facebookFeed"
                        checked={facebookFeed}
                        onChange={(e) => setFacebookFeed(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="facebookFeed" className="block text-sm font-medium text-gray-700 cursor-pointer mb-0.5">
                          Facebook Feed
                        </label>
                        <p className="text-xs text-gray-500">Main news feed</p>
                      </div>
                    </div>

                    {/* Facebook Stories */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="facebookStories"
                        checked={facebookStories}
                        onChange={(e) => setFacebookStories(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="facebookStories" className="block text-sm font-medium text-gray-700 cursor-pointer mb-0.5">
                          Facebook Stories
                        </label>
                        <p className="text-xs text-gray-500">Full-screen vertical</p>
                      </div>
                    </div>

                    {/* Facebook Reels */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="facebookReels"
                        checked={facebookReels}
                        onChange={(e) => setFacebookReels(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="facebookReels" className="block text-sm font-medium text-gray-700 cursor-pointer mb-0.5">
                          Facebook Reels
                        </label>
                        <p className="text-xs text-gray-500">Short-form video</p>
                      </div>
                    </div>

                    {/* Facebook Right Column */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="facebookRightColumn"
                        checked={facebookRightColumn}
                        onChange={(e) => setFacebookRightColumn(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="facebookRightColumn" className="block text-sm font-medium text-gray-700 cursor-pointer mb-0.5">
                          Facebook Right Column
                        </label>
                        <p className="text-xs text-gray-500">Desktop sidebar</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Instagram Placements */}
              {platformInstagram && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-[#1E3A5F] mb-3">Instagram Placements</h3>
                  <div className="space-y-3">
                    {/* Instagram Feed */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="instagramFeed"
                        checked={instagramFeed}
                        onChange={(e) => setInstagramFeed(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="instagramFeed" className="block text-sm font-medium text-gray-700 cursor-pointer">
                          Instagram Feed
                        </label>
                      </div>
                    </div>

                    {/* Instagram Stories */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="instagramStories"
                        checked={instagramStories}
                        onChange={(e) => setInstagramStories(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="instagramStories" className="block text-sm font-medium text-gray-700 cursor-pointer">
                          Instagram Stories
                        </label>
                      </div>
                    </div>

                    {/* Instagram Reels */}
                    <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <input
                        type="checkbox"
                        id="instagramReels"
                        checked={instagramReels}
                        onChange={(e) => setInstagramReels(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-[#0EA5E9] border-gray-300 rounded focus:ring-[#0EA5E9]"
                      />
                      <div className="flex-1">
                        <label htmlFor="instagramReels" className="block text-sm font-medium text-gray-700 cursor-pointer">
                          Instagram Reels
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STEP 8: Ad Preview */}
          {currentStep === 8 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Ad Preview</h2>
              <p className="text-sm text-gray-600 mb-8">See how your ad will look</p>

              {/* Preview Tabs */}
              <div className="flex items-center gap-2 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setPreviewTab('desktop')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    previewTab === 'desktop'
                      ? 'border-[#0EA5E9] text-[#0EA5E9]'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Desktop Feed
                </button>
                <button
                  onClick={() => setPreviewTab('mobile')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    previewTab === 'mobile'
                      ? 'border-[#0EA5E9] text-[#0EA5E9]'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Mobile Feed
                </button>
                <button
                  onClick={() => setPreviewTab('story')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    previewTab === 'story'
                      ? 'border-[#0EA5E9] text-[#0EA5E9]'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Story
                </button>
              </div>

              {/* Desktop Feed Preview */}
              {previewTab === 'desktop' && (
                <div className="max-w-xl mx-auto">
                  {/* Facebook Post Mockup */}
                  <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                    {/* Post Header */}
                    <div className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        SM
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-[15px] text-gray-900">Sarah Mitchell</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>Sponsored</span>
                          <span>·</span>
                          <Globe className="w-3 h-3" />
                        </div>
                      </div>
                    </div>

                    {/* Primary Text */}
                    <div className="px-4 pb-3">
                      <p className="text-[15px] text-gray-900 leading-relaxed">
                        {primaryText || 'If you have an investment portfolio of $500,000 or above, you may be overpaying in fees. Get a free portfolio analysis from our certified financial advisors.'}
                      </p>
                    </div>

                    {/* Ad Image */}
                    <div className="w-full">
                      <ImageWithFallback
                        src={adImages.find(img => selectedImages.includes(img.id))?.url || adImages[0].url}
                        alt="Ad preview"
                        className="w-full object-cover"
                      />
                    </div>

                    {/* Ad Content Card */}
                    <div className="bg-gray-50 p-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500 uppercase mb-1">yourfirm.com</div>
                      <div className="font-semibold text-[17px] text-gray-900 mb-1">
                        {headline || 'Thinking About Retirement?'}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {description || 'Click Here To Download Your FREE Guide!'}
                      </div>
                      <button className="w-full py-2 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-md text-sm transition-colors">
                        {ctaButton}
                      </button>
                    </div>

                    {/* Post Actions */}
                    <div className="px-4 py-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-gray-500">
                        <button className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-md transition-colors">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-sm font-medium">Like</span>
                        </button>
                        <button className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-md transition-colors">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Comment</span>
                        </button>
                        <button className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-md transition-colors">
                          <Share2 className="w-4 h-4" />
                          <span className="text-sm font-medium">Share</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ad Variants Info */}
                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-[#1E3A5F]">{selectedImages.length} ad variants</span> will be created (one per selected image)
                    </p>
                  </div>

                  {/* Compliance Notice */}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900">
                      Your ad will be reviewed by your compliance officer before going live.
                    </p>
                  </div>
                </div>
              )}

              {/* Mobile Feed Preview */}
              {previewTab === 'mobile' && (
                <div className="max-w-sm mx-auto">
                  {/* Facebook Mobile Post Mockup */}
                  <div className="bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                    {/* Post Header */}
                    <div className="p-3 flex items-center gap-2">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        SM
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">Sarah Mitchell</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <span>Sponsored</span>
                          <span>·</span>
                          <Globe className="w-3 h-3" />
                        </div>
                      </div>
                    </div>

                    {/* Primary Text */}
                    <div className="px-3 pb-2">
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {primaryText || 'If you have an investment portfolio of $500,000 or above, you may be overpaying in fees. Get a free portfolio analysis from our certified financial advisors.'}
                      </p>
                    </div>

                    {/* Ad Image */}
                    <div className="w-full">
                      <ImageWithFallback
                        src={adImages.find(img => selectedImages.includes(img.id))?.url || adImages[0].url}
                        alt="Ad preview"
                        className="w-full object-cover"
                      />
                    </div>

                    {/* Ad Content Card */}
                    <div className="bg-gray-50 p-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500 uppercase mb-1">yourfirm.com</div>
                      <div className="font-semibold text-[15px] text-gray-900 mb-1">
                        {headline || 'Thinking About Retirement?'}
                      </div>
                      <div className="text-xs text-gray-600 mb-2">
                        {description || 'Click Here To Download Your FREE Guide!'}
                      </div>
                      <button className="w-full py-2 px-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold rounded-md text-sm transition-colors">
                        {ctaButton}
                      </button>
                    </div>

                    {/* Post Actions */}
                    <div className="px-3 py-2 border-t border-gray-200">
                      <div className="flex items-center justify-between text-gray-500">
                        <button className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors">
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-xs font-medium">Like</span>
                        </button>
                        <button className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">Comment</span>
                        </button>
                        <button className="flex items-center gap-1.5 hover:bg-gray-100 px-2 py-1.5 rounded-md transition-colors">
                          <Share2 className="w-4 h-4" />
                          <span className="text-xs font-medium">Share</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ad Variants Info */}
                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-[#1E3A5F]">{selectedImages.length} ad variants</span> will be created (one per selected image)
                    </p>
                  </div>

                  {/* Compliance Notice */}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900">
                      Your ad will be reviewed by your compliance officer before going live.
                    </p>
                  </div>
                </div>
              )}

              {/* Story Preview */}
              {previewTab === 'story' && (
                <div className="max-w-xs mx-auto">
                  {/* Facebook Story Mockup */}
                  <div className="bg-black rounded-2xl overflow-hidden shadow-lg aspect-[9/16] relative">
                    {/* Story Image */}
                    <ImageWithFallback
                      src={adImages.find(img => selectedImages.includes(img.id))?.url || adImages[0].url}
                      alt="Story preview"
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Story Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70">
                      {/* Top Profile Info */}
                      <div className="p-4 flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">
                          SM
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-xs text-white">Sarah Mitchell</div>
                          <div className="text-xs text-white/80">Sponsored</div>
                        </div>
                      </div>

                      {/* Bottom Content */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                        <div>
                          <div className="font-semibold text-lg text-white mb-1">
                            {headline || 'Thinking About Retirement?'}
                          </div>
                          <p className="text-sm text-white/90">
                            {description || 'Click Here To Download Your FREE Guide!'}
                          </p>
                        </div>
                        <button className="w-full py-3 px-4 bg-white text-gray-900 font-semibold rounded-lg text-sm">
                          {ctaButton}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ad Variants Info */}
                  <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-[#1E3A5F]">{selectedImages.length} ad variants</span> will be created (one per selected image)
                    </p>
                  </div>

                  {/* Compliance Notice */}
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900">
                      Your ad will be reviewed by your compliance officer before going live.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* STEP 9: Review & Submit */}
          {currentStep === 9 && (
            <Card className="p-8 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F] mb-2">Review & Submit</h2>
              <p className="text-sm text-gray-600 mb-8">Review your campaign before submitting for compliance review</p>

              {/* Summary Table */}
              <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden mb-6">
                {/* Campaign Name */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Campaign Name</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {campaignName || 'Retirement Planning Free Consultation'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Objective */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Objective</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {campaignObjective === 'lead-generation' ? 'Lead Generation' : 
                       campaignObjective === 'awareness' ? 'Awareness' : 'Traffic'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Daily Budget */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Daily Budget</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      ${dailyBudget}/day
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Duration */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Duration</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {runContinuously ? (
                        'Continuous'
                      ) : (
                        <>
                          {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days)
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Est. Total Spend */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Est. Total Spend</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {runContinuously ? 'N/A (Continuous)' : `$${calculateTotalSpend()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(5)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Audience */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Audience</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {audienceType === 'advantage' ? 'Advantage Audience' : 'Manual Audience'}, Age {ageMin}-{ageMax}, {locations.join(', ')}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(6)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Platforms */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Platforms</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {(() => {
                        const placements = [];
                        if (platformFacebook) {
                          if (facebookFeed) placements.push('Facebook Feed');
                          if (facebookStories) placements.push('Facebook Stories');
                          if (facebookReels) placements.push('Facebook Reels');
                          if (facebookRightColumn) placements.push('Facebook Right Column');
                        }
                        if (platformInstagram) {
                          if (instagramFeed) placements.push('Instagram Feed');
                          if (instagramStories) placements.push('Instagram Stories');
                          if (instagramReels) placements.push('Instagram Reels');
                        }
                        return placements.length > 0 ? placements.join(', ') : 'Facebook Feed';
                      })()}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(7)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Lead Capture */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Lead Capture</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {leadCaptureMethod === 'facebook-form' ? `Facebook Lead Form (${formFields.length} fields)` : 'Landing Page'}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Email Follow-up */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border-b border-gray-200 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Email Follow-up</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {emailSequence}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>

                {/* Ad Variants */}
                <div className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-600 mb-1">Ad Variants</div>
                    <div className="text-[15px] text-[#1E3A5F] font-medium">
                      {selectedImages.length}
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="text-sm text-[#0EA5E9] hover:underline ml-4"
                  >
                    Edit
                  </button>
                </div>
              </div>

              {/* Compliance Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-900 mb-1">Compliance Review Required</div>
                  <p className="text-sm text-amber-800">
                    This ad will be submitted to your compliance officer for review before it can go live. Ads containing investment-related claims must include appropriate risk disclosures per FINRA Rule 2210.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Bottom Action Bar (Sticky) */}
      <div className="bg-white border-t border-gray-200 px-8 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          {/* Step 9 has three buttons */}
          {currentStep === 9 ? (
            <>
              {/* Left: Back */}
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Back: Preview
              </Button>

              {/* Center: Save as Draft */}
              <Button
                variant="outline"
                onClick={() => {
                  alert('Campaign saved as draft!');
                  navigate('/facebook');
                }}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Save as Draft
              </Button>

              {/* Right: Submit for Compliance Review */}
              <Button
                onClick={() => {
                  navigate('/facebook-submitted');
                }}
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-6"
              >
                Submit for Compliance Review
              </Button>
            </>
          ) : (
            <>
              {/* Left: Cancel / Back */}
              <div>
                {currentStep === 1 ? (
                  <button
                    onClick={handleCancel}
                    className="text-sm text-gray-600 hover:text-[#1E3A5F] transition-colors"
                  >
                    Cancel
                  </button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </Button>
                )}
              </div>

              {/* Right: Next Button */}
              <Button
                onClick={handleNext}
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
              >
                <>
                  Next: {steps[currentStep]?.label || 'Continue'}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}