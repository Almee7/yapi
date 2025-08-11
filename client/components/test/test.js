import React from 'react';
import { Checkbox } from 'antd';

const CheckboxHeader = ({ checked, indeterminate, onChange }) => (
    <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange}
    />
);

export default CheckboxHeader;