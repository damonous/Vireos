import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useNavigate } from 'react-router';
import { Toast } from '../components/ui/toast';
import { Search, Baby, Home, Briefcase, Heart, UserMinus, Sunset, Linkedin } from 'lucide-react';

const prospects = [
  { id: 1, name: 'Robert Chen', title: 'CFO', company: 'Meridian Corp', location: 'San Francisco, CA' },
  { id: 2, name: 'Patricia Walsh', title: 'Business Owner', company: 'Walsh & Associates', location: 'Boston, MA' },
  { id: 3, name: 'David Kim', title: 'VP Finance', company: 'Suncoast Industries', location: 'Miami, FL' },
  { id: 4, name: 'Jennifer Martinez', title: 'CEO', company: 'Martinez Financial Group', location: 'Austin, TX' },
  { id: 5, name: 'Michael Thompson', title: 'Retired Executive', company: 'Former Fortune 500', location: 'Seattle, WA' },
  { id: 6, name: 'Lisa Anderson', title: 'Managing Director', company: 'Anderson Capital Partners', location: 'Chicago, IL' },
  { id: 7, name: 'James Rodriguez', title: 'Business Owner', company: 'Rodriguez Enterprises', location: 'Denver, CO' },
];

export default function ProspectFinder() {
  const navigate = useNavigate();
  const [selectedProspects, setSelectedProspects] = useState<number[]>([]);
  const [enrollInCampaign, setEnrollInCampaign] = useState(false);
  const [location, setLocation] = useState('United States');
  const [jobTitle, setJobTitle] = useState('');
  const [companySize, setCompanySize] = useState('51-200');
  const [industry, setIndustry] = useState('financial');
  const [ageRange, setAgeRange] = useState('45-65');
  const [lifeEvents, setLifeEvents] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState({
    companySize: true,
    industry: true,
    ageRange: true
  });
  const [isSearching, setIsSearching] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const selectedCount = selectedProspects.length;

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setShowToast(true);
    }, 800);
  };

  const toggleFilter = (filter: keyof typeof activeFilters) => {
    setActiveFilters(prev => ({ ...prev, [filter]: !prev[filter] }));
  };

  const toggleProspect = (id: number) => {
    setSelectedProspects(prev =>
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedProspects.length === prospects.length) {
      setSelectedProspects([]);
    } else {
      setSelectedProspects(prospects.map(p => p.id));
    }
  };

  const toggleLifeEvent = (event: string) => {
    setLifeEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Prospect Finder</h1>
            <p className="text-sm text-gray-500 mt-1">Discover and qualify new prospects</p>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Left Filter Panel */}
        <div className="w-80 bg-white border-r border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Search Filters</h3>
          
          <div className="space-y-5">
            <div>
              <Label htmlFor="location" className="text-sm font-medium text-gray-700 mb-2 block">
                Location
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter location"
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="jobTitle" className="text-sm font-medium text-gray-700 mb-2 block">
                Job Title
              </Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g., CEO, CFO, Business Owner"
                className="w-full"
              />
            </div>

            <div>
              <Label htmlFor="companySize" className="text-sm font-medium text-gray-700 mb-2 block">
                Company Size
              </Label>
              <Select value={companySize} onValueChange={setCompanySize}>
                <SelectTrigger id="companySize" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501-1000">501-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="industry" className="text-sm font-medium text-gray-700 mb-2 block">
                Industry
              </Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="financial">Financial Services</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="real-estate">Real Estate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="ageRange" className="text-sm font-medium text-gray-700 mb-2 block">
                Age Range
              </Label>
              <Select value={ageRange} onValueChange={setAgeRange}>
                <SelectTrigger id="ageRange" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25-35">25-35 years</SelectItem>
                  <SelectItem value="35-45">35-45 years</SelectItem>
                  <SelectItem value="45-55">45-55 years</SelectItem>
                  <SelectItem value="45-65">45-65 years</SelectItem>
                  <SelectItem value="55-65">55-65 years</SelectItem>
                  <SelectItem value="65+">65+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Life Events Section */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <Label className="text-sm font-medium text-gray-700">
                  Life Events
                </Label>
                {lifeEvents.length > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold text-[#0EA5E9] bg-[#0EA5E9]/10 rounded">
                    {lifeEvents.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">Target prospects experiencing major life transitions</p>
              
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={lifeEvents.includes('newborn')}
                    onCheckedChange={() => toggleLifeEvent('newborn')}
                  />
                  <Baby className="w-4 h-4 text-gray-500 group-hover:text-gray-700 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Newborn Child</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={lifeEvents.includes('moved')}
                    onCheckedChange={() => toggleLifeEvent('moved')}
                  />
                  <Home className="w-4 h-4 text-gray-500 group-hover:text-gray-700 flex-shrink-0" />
                  <span className="text-sm text-gray-700">New Address / Recently Moved</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={lifeEvents.includes('job-change')}
                    onCheckedChange={() => toggleLifeEvent('job-change')}
                  />
                  <Briefcase className="w-4 h-4 text-gray-500 group-hover:text-gray-700 flex-shrink-0" />
                  <span className="text-sm text-gray-700">New Job Title / Job Change</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={lifeEvents.includes('married')}
                    onCheckedChange={() => toggleLifeEvent('married')}
                  />
                  <Heart className="w-4 h-4 text-gray-500 group-hover:text-gray-700 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Recently Married</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={lifeEvents.includes('divorced')}
                    onCheckedChange={() => toggleLifeEvent('divorced')}
                  />
                  <UserMinus className="w-4 h-4 text-gray-500 group-hover:text-gray-700 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Recently Divorced</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={lifeEvents.includes('retired')}
                    onCheckedChange={() => toggleLifeEvent('retired')}
                  />
                  <Sunset className="w-4 h-4 text-gray-500 group-hover:text-gray-700 flex-shrink-0" />
                  <span className="text-sm text-gray-700">Recently Retired</span>
                </label>
              </div>
            </div>

            <Button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              Search Prospects
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm font-medium text-[#1E3A5F] mb-1">Search Tips</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Be specific with job titles</li>
                <li>• Results update in real-time</li>
                <li>• Use life events for precise targeting</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Results Area */}
        <div className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Search Results</h3>
              <p className="text-sm text-gray-500 mt-1">{prospects.length} prospects found</p>
            </div>
          </div>

          <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 w-12">
                      <Checkbox
                        checked={selectedProspects.length === prospects.length}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Company</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">LinkedIn</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((prospect) => (
                    <tr
                      key={prospect.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                        selectedProspects.includes(prospect.id) ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => toggleProspect(prospect.id)}
                    >
                      <td className="py-4 px-4">
                        <Checkbox
                          checked={selectedProspects.includes(prospect.id)}
                          onCheckedChange={() => toggleProspect(prospect.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-[#1E3A5F]">{prospect.name}</p>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{prospect.title}</td>
                      <td className="py-4 px-4 text-sm text-gray-700">{prospect.company}</td>
                      <td className="py-4 px-4 text-sm text-gray-500">{prospect.location}</td>
                      <td className="py-4 px-4 text-center">
                        <button className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors">
                          <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bottom Action Bar */}
          {selectedCount > 0 && (
            <Card className="mt-6 p-4 rounded-lg shadow-lg border-2 border-[#0EA5E9] bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-sm text-gray-600">Selected Prospects</p>
                    <p className="text-2xl font-semibold text-[#1E3A5F]">{selectedCount}</p>
                  </div>
                  <div className="h-12 w-px bg-gray-200"></div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={enrollInCampaign}
                      onCheckedChange={(checked) => setEnrollInCampaign(!!checked)}
                    />
                    <span className="text-sm font-medium text-gray-700">Enroll in LinkedIn Campaign</span>
                  </label>
                </div>
                <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-8">
                  Import Selected ({selectedCount})
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          type="success"
          message="Search completed successfully!"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}