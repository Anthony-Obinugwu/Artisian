import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Define the props for the WelcomeScreen component
interface WelcomeScreenProps {
  imageUrl: string;
  title: React.ReactNode;
  description: string;
  buttonText: string;
  onButtonClick: () => void;
  secondaryActionText?: React.ReactNode;
  onSecondaryActionClick?: () => void;
  onMouseEnterButton?: () => void;
  onTouchStartButton?: () => void;
  className?: string;
  footerContent?: React.ReactNode;
}

/**
 * A responsive and animated welcome screen component.
 * It uses framer-motion for animations and is styled with shadcn/ui theme variables.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  imageUrl,
  title,
  description,
  buttonText,
  onButtonClick,
  secondaryActionText,
  onSecondaryActionClick,
  onMouseEnterButton,
  onTouchStartButton,
  className,
  footerContent,
}) => {
  // Animation variants for the container and its children
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
      },
    },
  };
  
  const imageVariants: Variants = {
    hidden: { y: -50, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        duration: 0.8,
      },
    },
  };

  return (
    <div
      className={cn(
        'flex h-full w-full flex-col items-center justify-between bg-[#060B18] text-white min-h-screen relative overflow-hidden',
        className
      )}
    >
      {/* Top Image Section with a curved clip-path */}
      <motion.div 
        className="relative w-full overflow-hidden"
        initial="hidden"
        animate="visible"
        variants={imageVariants}
      >
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          <img
            src={imageUrl}
            alt="Welcome"
            className="h-full w-full object-cover brightness-75"
            style={{ clipPath: 'ellipse(100% 65% at 50% 35%)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060B18]/60 to-[#060B18]" />
        </div>
      </motion.div>

      {/* Content Section */}
      <motion.div
        className="flex flex-1 flex-col items-center justify-center space-y-4 px-6 py-6 text-center max-w-md z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Title */}
        <motion.h1
          className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          variants={itemVariants}
        >
          {title}
        </motion.h1>

        {/* Description */}
        <motion.p
          className="text-slate-400 text-base sm:text-lg leading-relaxed"
          variants={itemVariants}
        >
          {description}
        </motion.p>
      </motion.div>
      
      {/* Actions Section */}
      <motion.div 
        className="w-full max-w-md space-y-4 p-6 pt-0 z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Primary Button */}
        <motion.div variants={itemVariants}>
          <Button 
            onClick={onButtonClick} 
            onMouseEnter={onMouseEnterButton}
            onTouchStart={onTouchStartButton}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 text-lg rounded-2xl shadow-[0_0_25px_rgba(37,99,235,0.4)] hover:shadow-[0_0_35px_rgba(37,99,235,0.6)] transition-all h-auto cursor-pointer" 
            size="lg"
          >
            {buttonText}
          </Button>
        </motion.div>

        {/* Secondary Action Link */}
        {secondaryActionText && onSecondaryActionClick && (
          <motion.div variants={itemVariants} className="text-center">
            <Button
              variant="link"
              onClick={onSecondaryActionClick}
              className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {secondaryActionText}
            </Button>
          </motion.div>
        )}

        {footerContent && (
          <motion.div variants={itemVariants} className="pt-2 text-center">
            {footerContent}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
