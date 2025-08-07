import React from 'react';

const Skills = () => {
  return (
    <section id="skills" className="py-20 bg-gray-900">
      <div className="container mx-auto text-center">
        <h2 className="text-4xl font-bold mb-8">Skills</h2>
        <div className="skills-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 mt-12">
          <div className="skill-badge bg-blue-500 text-white py-4 px-6 rounded-lg text-xl">UI/UX Design</div>
          <div className="skill-badge bg-blue-500 text-white py-4 px-6 rounded-lg text-xl">Web Development</div>
          <div className="skill-badge bg-blue-500 text-white py-4 px-6 rounded-lg text-xl">Graphic Design</div>
          <div className="skill-badge bg-blue-500 text-white py-4 px-6 rounded-lg text-xl">Digital Marketing</div>
        </div>
      </div>
    </section>
  );
};

export default Skills;
