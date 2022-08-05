package com.appsmith.caching;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableLoadTimeWeaving;

@Configuration
@ComponentScan(basePackages="com.appsmith.caching")
@EnableLoadTimeWeaving
public class CachingConfig {
}
