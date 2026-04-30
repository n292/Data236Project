import React, { useState, useEffect } from 'react';
import './EasyApplyModal.css';
import { getMember } from '../api/memberApi';
import { getDraft } from '../api/applicationApi';

const steps = [
  { id: 1, title: 'Contact Info' },
  { id: 2, title: 'Resume' },
  { id: 3, title: 'Top Choice' },
  { id: 4, title: 'Additional Details' },
  { id: 5, title: 'Review' },
];

export default function EasyApplyModal({ job, user, onClose, onSubmit, onSave }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    resumeRef: '', // No default — use the actually uploaded file
    isTopChoice: false,
    education: '',
    experience: '',
    coverLetter: ''
  });
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeFileName, setResumeFileName] = useState('resume_v2_2024.pdf'); // Default mock
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Try to load draft first
        const draft = await getDraft(job.job_id, user.member_id);
        if (draft) {
          const meta = draft.metadata || {};
          setFormData({
            firstName: meta.first_name || '',
            lastName: meta.last_name || '',
            email: meta.email || '',
            phone: meta.phone || '',
            address: meta.address || '',
            resumeRef: draft.resume_url || '',
            isTopChoice: meta.is_top_choice || false,
            education: meta.education || '',
            experience: meta.experience || '',
            coverLetter: draft.cover_letter || ''
          });
        } else {
          // 2. Otherwise load profile defaults
          const profile = await getMember(user.member_id);
          const m = profile.member || profile;
          setFormData(prev => ({
            ...prev,
            firstName: m.first_name || '',
            lastName: m.last_name || '',
            email: m.email || '',
            phone: m.phone || '',
            address: m.location || ''
          }));
        }
      } catch (err) {
        console.error('Failed to load application data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [job.job_id, user.member_id]);

  const progress = (currentStep / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setIsDirty(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setResumeFile(file);
      setResumeFileName(file.name);
      setIsDirty(true);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        job_id: job.job_id,
        member_id: user.member_id,
        recruiter_id: job.recruiter_id,
        resume_ref: formData.resumeRef,
        resume_file: resumeFile,
        cover_letter: formData.coverLetter,
        metadata: {
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          is_top_choice: formData.isTopChoice,
          education: formData.education,
          experience: formData.experience
        },
        is_draft: false
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    await onSave({
      job_id: job.job_id,
      member_id: user.member_id,
      recruiter_id: job.recruiter_id,
      resume_ref: formData.resumeRef,
      resume_file: resumeFile,
      cover_letter: formData.coverLetter,
      metadata: {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        is_top_choice: formData.isTopChoice,
        education: formData.education,
        experience: formData.experience
      },
      is_draft: true
    });
    onClose();
  };

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  };

  if (isLoading) {
    return (
      <div className="ea-modal-overlay">
        <div className="ea-modal ea-modal--loading">
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  if (showExitConfirm) {
    return (
      <div className="ea-modal-overlay">
        <div className="ea-modal ea-modal--confirm">
          <div className="ea-modal__content">
            <h3>Save your progress?</h3>
            <p>Your application is almost ready. You can save it as a draft and finish it later.</p>
          </div>
          <footer className="ea-modal__footer ea-modal__footer--column">
            <button className="ea-btn-primary" onClick={handleSaveDraft}>Save as draft</button>
            <button className="ea-btn-outline" onClick={onClose}>Discard application</button>
            <button className="ea-btn-flat" onClick={() => setShowExitConfirm(false)}>Cancel</button>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="ea-modal-overlay">
      <div className="ea-modal">
        <header className="ea-modal__header">
          <div className="ea-modal__header-left">
            <h2 className="ea-modal__title">Apply to {job.company}</h2>
            <p className="ea-modal__subtitle">{job.title} · {job.location}</p>
          </div>
          <button className="ea-modal__close" onClick={handleCloseAttempt}>&times;</button>
        </header>

        <div className="ea-modal__progress-container">
          <div className="ea-modal__progress-bar" style={{ width: `${progress}%` }}></div>
        </div>

        <main className="ea-modal__content">
          {currentStep === 1 && (
            <div className="ea-step">
              <h3 className="ea-step__title">Contact info</h3>
              <div className="ea-form-group">
                <label>First name</label>
                <input name="firstName" value={formData.firstName} onChange={handleInputChange} />
              </div>
              <div className="ea-form-group">
                <label>Last name</label>
                <input name="lastName" value={formData.lastName} onChange={handleInputChange} />
              </div>
              <div className="ea-form-group">
                <label>Email address</label>
                <input name="email" value={formData.email} onChange={handleInputChange} />
              </div>
              <div className="ea-form-group">
                <label>Phone number</label>
                <input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="+1 123 456 7890" />
              </div>
              <div className="ea-form-group">
                <label>Address (City, State)</label>
                <input name="address" value={formData.address} onChange={handleInputChange} placeholder="San Francisco, CA" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="ea-step">
              <h3 className="ea-step__title">Resume</h3>
              <p className="ea-step__desc">Be sure to include an updated resume.</p>
              <div className="ea-resume-card">
                <div className="ea-resume-card__icon">📄</div>
                <div className="ea-resume-card__info">
                  <p className="ea-resume-card__name">{resumeFileName}</p>
                  <p className="ea-resume-card__date">
                    {resumeFile ? 'Selected for upload' : 'Uploaded on Apr 28, 2026'}
                  </p>
                </div>
                <input type="radio" checked readOnly />
              </div>
              <label className="ea-btn-outline" style={{ cursor: 'pointer', display: 'inline-block' }}>
                Upload resume
                <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} accept=".pdf,.doc,.docx" />
              </label>
            </div>
          )}

          {currentStep === 3 && (
            <div className="ea-step">
              <h3 className="ea-step__title">Optional enhancements</h3>
              <label className="ea-checkbox-group">
                <input type="checkbox" name="isTopChoice" checked={formData.isTopChoice} onChange={handleInputChange} />
                <span>Mark as top choice</span>
              </label>
              <p className="ea-hint">Recruiters will see that this is one of your top interests.</p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="ea-step">
              <h3 className="ea-step__title">Additional details</h3>
              <div className="ea-form-group">
                <label>Education</label>
                <textarea name="education" value={formData.education} onChange={handleInputChange} placeholder="e.g. BS Computer Science, UC Berkeley" />
              </div>
              <div className="ea-form-group">
                <label>Experience</label>
                <textarea name="experience" value={formData.experience} onChange={handleInputChange} placeholder="e.g. 3 years at Google as Software Engineer" />
              </div>
              <div className="ea-form-group">
                <label>Cover letter (Optional)</label>
                <textarea name="coverLetter" value={formData.coverLetter} onChange={handleInputChange} placeholder="Why are you a good fit?" />
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="ea-step">
              <h3 className="ea-step__title">Review your application</h3>
              <div className="ea-review-section">
                <h4>Contact Info</h4>
                <p>{formData.firstName} {formData.lastName}</p>
                <p>{formData.email}</p>
                <p>{formData.phone}</p>
                <p>{formData.address}</p>
              </div>
              <div className="ea-review-section">
                <h4>Resume</h4>
                <p>resume_v2_2024.pdf</p>
              </div>
              <div className="ea-review-section">
                <h4>Additional Details</h4>
                <p><strong>Top Choice:</strong> {formData.isTopChoice ? 'Yes' : 'No'}</p>
                <p><strong>Education:</strong> {formData.education || 'Not provided'}</p>
                <p><strong>Experience:</strong> {formData.experience || 'Not provided'}</p>
              </div>
            </div>
          )}
        </main>

        <footer className="ea-modal__footer">
          <div className="ea-modal__footer-left">
            {currentStep === 1 ? (
              <button className="ea-btn-flat" onClick={handleSaveDraft}>Save as draft</button>
            ) : (
              <button className="ea-btn-flat" onClick={handleBack}>Back</button>
            )}
          </div>
          <div className="ea-modal__footer-right">
            {currentStep < steps.length ? (
              <button className="ea-btn-primary" onClick={handleNext}>Next</button>
            ) : (
              <button className="ea-btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit application'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
